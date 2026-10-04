package com.feedbackkit.ui

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.media.ExifInterface
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import android.provider.OpenableColumns
import android.text.Editable
import android.text.InputType
import android.text.TextUtils
import android.text.TextWatcher
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.inputmethod.InputMethodManager
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.PopupMenu
import android.widget.ProgressBar
import android.widget.TextView
import com.feedbackkit.AnnotationRenderer
import com.feedbackkit.FeedbackAttachment
import com.feedbackkit.FeedbackKit
import com.feedbackkit.FeedbackProduct
import com.feedbackkit.FeedbackReport
import com.feedbackkit.FeedbackTheme
import com.feedbackkit.R
import com.feedbackkit.internal.EnvironmentInfo
import com.feedbackkit.internal.FeedbackKitFileProvider
import com.feedbackkit.internal.Http
import java.io.ByteArrayOutputStream
import java.io.File
import kotlin.math.max
import kotlin.math.roundToInt

/** Hands the captured screenshot and callback to [FeedbackActivity] — a bitmap is too big for an Intent. */
internal object FeedbackSession {
    class Request(
        val screenshot: Bitmap,
        val screenName: String?,
        val theme: FeedbackTheme?,
        val composerPlaceholder: String,
        val onComplete: (FeedbackReport?) -> Unit,
    )

    var pending: Request? = null
}

/**
 * The full-screen capture → annotate → describe → submit flow. Not part of
 * the public API — started and finished by [FeedbackKit]. Built in code from
 * framework views (no AppCompat/Compose), mirroring the iOS
 * `FeedbackViewController`: a header with Cancel, the screenshot in a phone
 * bezel with the tool rail beside it, and a compact chat-style composer.
 */
class FeedbackActivity : Activity() {
    private lateinit var request: FeedbackSession.Request
    private lateinit var palette: Palette
    private var delivered = false

    private lateinit var canvasView: AnnotationCanvasView
    private lateinit var toolbar: AnnotationToolbar
    private lateinit var textInput: EditText
    private lateinit var sendButton: ImageButton
    private lateinit var attachButton: ImageButton
    private lateinit var optionsSummary: TextView
    private lateinit var attachmentChip: LinearLayout
    private lateinit var attachmentName: TextView
    private lateinit var progress: ProgressBar

    private var includesScreenshot = true
    private var notifyReporter = false
    private var attachment: FeedbackAttachment? = null
    private val selectedProductKeys = linkedSetOf<String>()
    private var pendingPhotoFile: File? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val pending = FeedbackSession.pending
        if (pending == null) {
            // The process was recreated while the editor was open — the screenshot is gone.
            delivered = true
            finish()
            return
        }
        request = pending
        palette = Palette(this, request.theme)
        goEdgeToEdge()
        setContentView(buildContent())
    }

    // MARK: - Layout

    private fun goEdgeToEdge() {
        if (Build.VERSION.SDK_INT >= 30) {
            window.setDecorFitsSystemWindows(false)
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LAYOUT_STABLE or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or (if (palette.isDark) 0 else View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR)
        }
    }

    private fun buildContent(): View {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(palette.background)
        }
        root.addView(buildHeader(), LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, palette.dp(48)))

        val middle = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        canvasView = AnnotationCanvasView(this, request.screenshot).apply {
            onRequestTextInput = { completion -> presentTextPrompt(completion) }
        }
        toolbar = AnnotationToolbar(this, palette).apply {
            onToolSelected = { canvasView.tool = it }
            onColorSelected = { canvasView.strokeColor = it }
            onUndo = { canvasView.undoLast() }
        }
        middle.addView(canvasView, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1f).apply {
            leftMargin = palette.dp(16)
            rightMargin = palette.dp(4)
        })
        // Scrolls rather than clipping when the keyboard leaves it less room.
        val toolbarScroller = android.widget.ScrollView(this).apply {
            isFillViewport = true
            isVerticalScrollBarEnabled = false
            addView(toolbar)
        }
        middle.addView(toolbarScroller, LinearLayout.LayoutParams(palette.dp(56), ViewGroup.LayoutParams.MATCH_PARENT).apply {
            rightMargin = palette.dp(4)
        })
        root.addView(middle, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f).apply {
            topMargin = palette.dp(8)
        })

        root.addView(buildComposer(), LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            setMargins(palette.dp(16), palette.dp(8), palette.dp(16), palette.dp(12))
        })

        // System bars and the keyboard: pad the content so the composer rides above the IME.
        root.setOnApplyWindowInsetsListener { view, insets ->
            val top: Int
            val bottom: Int
            val left: Int
            val right: Int
            if (Build.VERSION.SDK_INT >= 30) {
                val bars = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout())
                val ime = insets.getInsets(WindowInsets.Type.ime())
                top = bars.top; left = bars.left; right = bars.right
                bottom = max(bars.bottom, ime.bottom)
            } else {
                @Suppress("DEPRECATION")
                run {
                    top = insets.systemWindowInsetTop; left = insets.systemWindowInsetLeft
                    right = insets.systemWindowInsetRight; bottom = insets.systemWindowInsetBottom
                }
            }
            view.setPadding(left, top, right, bottom)
            insets
        }
        // Tapping anywhere outside the composer dismisses the keyboard, like Messages/Mail.
        canvasView.setOnTouchListener { _, event ->
            if (event.actionMasked == android.view.MotionEvent.ACTION_DOWN) hideKeyboard()
            false
        }
        return root
    }

    private fun buildHeader(): View = FrameLayout(this).apply {
        val title = TextView(context).apply {
            text = "Report Feedback"
            setTextColor(palette.label)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 17f)
            typeface = Typeface.DEFAULT_BOLD
        }
        addView(title, FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER))
        val cancel = TextView(context).apply {
            text = "Cancel"
            setTextColor(palette.secondary)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 17f)
            gravity = Gravity.CENTER_VERTICAL
            setPadding(palette.dp(16), 0, palette.dp(16), 0)
            isClickable = true
            setOnClickListener { cancel() }
        }
        addView(cancel, FrameLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.MATCH_PARENT, Gravity.START))
    }

    private fun buildComposer(): View {
        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            background = GradientDrawable().apply {
                setColor(palette.background)
                cornerRadius = palette.dp(16f)
                setStroke(palette.dp(1), palette.separator)
            }
            setPadding(palette.dp(12), palette.dp(10), palette.dp(12), palette.dp(8))
        }

        attachmentChip = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            visibility = View.GONE
            background = GradientDrawable().apply {
                setColor(palette.secondaryBackground)
                cornerRadius = palette.dp(8f)
            }
            setPadding(palette.dp(8), palette.dp(4), palette.dp(4), palette.dp(4))
            addView(ImageView(context).apply {
                setImageResource(R.drawable.fk_ic_attach)
                setColorFilter(palette.secondaryLabel)
            }, LinearLayout.LayoutParams(palette.dp(16), palette.dp(16)))
            attachmentName = TextView(context).apply {
                setTextColor(palette.secondaryLabel)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
                maxLines = 1
                ellipsize = TextUtils.TruncateAt.MIDDLE
                setPadding(palette.dp(6), 0, palette.dp(6), 0)
            }
            addView(attachmentName, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
            addView(ImageButton(context).apply {
                setImageResource(R.drawable.fk_ic_cancel)
                setColorFilter(palette.secondaryLabel)
                background = null
                contentDescription = "Remove attachment"
                setOnClickListener { setAttachment(null) }
            }, LinearLayout.LayoutParams(palette.dp(28), palette.dp(28)))
        }
        container.addView(attachmentChip, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            bottomMargin = palette.dp(8)
        })

        buildProductsRow()?.let {
            container.addView(it, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, palette.dp(28)).apply {
                bottomMargin = palette.dp(8)
            })
        }

        textInput = EditText(this).apply {
            hint = request.composerPlaceholder
            setHintTextColor(palette.placeholder)
            setTextColor(palette.label)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 17f)
            background = null
            setPadding(0, 0, 0, 0)
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
            minLines = 1
            maxLines = 5
            isVerticalScrollBarEnabled = true
        }
        container.addView(textInput, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))

        // The composer's second row: options/attach menu on the left, a summary
        // of non-default options and send on the right.
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        attachButton = ImageButton(this).apply {
            setImageResource(R.drawable.fk_ic_add_circle)
            setColorFilter(palette.attach)
            background = null
            scaleType = ImageView.ScaleType.FIT_CENTER
            setPadding(0, 0, 0, 0)
            contentDescription = "Options and attachments"
            setOnClickListener { showAttachMenu() }
        }
        row.addView(attachButton, LinearLayout.LayoutParams(palette.dp(32), palette.dp(32)))
        row.addView(View(this), LinearLayout.LayoutParams(0, 1, 1f))
        optionsSummary = TextView(this).apply {
            setTextColor(palette.secondaryLabel)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
            setPadding(0, 0, palette.dp(6), 0)
        }
        row.addView(optionsSummary)
        progress = ProgressBar(this).apply { visibility = View.GONE; isIndeterminate = true }
        row.addView(progress, LinearLayout.LayoutParams(palette.dp(24), palette.dp(24)).apply { rightMargin = palette.dp(4) })
        sendButton = ImageButton(this).apply {
            setImageResource(R.drawable.fk_ic_send_circle)
            setColorFilter(palette.primary)
            background = null
            scaleType = ImageView.ScaleType.FIT_CENTER
            setPadding(0, 0, 0, 0)
            contentDescription = "Send"
            setOnClickListener { submit() }
        }
        row.addView(sendButton, LinearLayout.LayoutParams(palette.dp(32), palette.dp(32)))
        container.addView(row, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            topMargin = palette.dp(8)
        })
        updateOptionsSummary()
        return container
    }

    private fun buildProductsRow(): View? {
        val products = FeedbackKit.products
        if (products.isEmpty()) return null
        val defaultKey = FeedbackKit.defaultProductKey?.takeIf { key -> products.any { it.key == key } }
            ?: products.firstOrNull { it.isDefault }?.key
        defaultKey?.let { selectedProductKeys += it }

        val strip = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        products.forEach { product ->
            val chip = TextView(this).apply {
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
                typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
                setPadding(palette.dp(10), palette.dp(4), palette.dp(10), palette.dp(4))
                isClickable = true
            }
            styleChip(chip, product)
            chip.setOnClickListener {
                if (!selectedProductKeys.remove(product.key)) selectedProductKeys += product.key
                styleChip(chip, product)
            }
            strip.addView(chip, LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                rightMargin = palette.dp(6)
            })
        }
        return HorizontalScrollView(this).apply {
            isHorizontalScrollBarEnabled = false
            addView(strip)
        }
    }

    private fun styleChip(chip: TextView, product: FeedbackProduct) {
        val selected = product.key in selectedProductKeys
        chip.text = if (selected) "✓ ${product.name}" else product.name
        chip.setTextColor(if (selected) palette.primary else palette.secondaryLabel)
        chip.background = GradientDrawable().apply {
            cornerRadius = palette.dp(12f)
            if (selected) {
                setColor(withAlpha(palette.primary, 0.15f))
                setStroke(palette.dp(1), withAlpha(palette.primary, 0.4f))
            } else {
                setColor(palette.secondaryBackground)
                setStroke(max(1, palette.dp(1) / 2), palette.separator)
            }
        }
    }

    // MARK: - Options menu

    private fun showAttachMenu() {
        hideKeyboard()
        val menu = PopupMenu(this, attachButton)
        menu.menu.add(0, MENU_FILE, 0, "Attach File…")
        menu.menu.add(0, MENU_PHOTO, 1, "Photo Library")
        if (canTakePhoto()) menu.menu.add(0, MENU_CAMERA, 2, "Take Photo")
        menu.menu.add(1, MENU_SCREENSHOT, 3, "Include Screenshot").setCheckable(true).setChecked(includesScreenshot)
        menu.menu.add(1, MENU_NOTIFY, 4, "Notify Me When It's Fixed").setCheckable(true).setChecked(notifyReporter)
        if (Build.VERSION.SDK_INT >= 28) menu.menu.setGroupDividerEnabled(true)
        menu.setOnMenuItemClickListener { item ->
            when (item.itemId) {
                MENU_FILE -> pickFile()
                MENU_PHOTO -> pickPhoto()
                MENU_CAMERA -> takePhoto()
                MENU_SCREENSHOT -> setIncludesScreenshot(!includesScreenshot)
                MENU_NOTIFY -> {
                    notifyReporter = !notifyReporter
                    updateOptionsSummary()
                }
            }
            true
        }
        menu.show()
    }

    private fun setIncludesScreenshot(included: Boolean) {
        includesScreenshot = included
        // The screenshot stays visible either way — off just dims it and
        // disables drawing, so flipping it back loses nothing.
        canvasView.isEnabled = included
        toolbar.isEnabled = included
        for (i in 0 until toolbar.childCount) toolbar.getChildAt(i).isEnabled = included
        canvasView.animate().alpha(if (included) 1f else 0.4f).setDuration(200).start()
        toolbar.animate().alpha(if (included) 1f else 0.4f).setDuration(200).start()
        updateOptionsSummary()
    }

    private fun updateOptionsSummary() {
        val parts = buildList {
            if (!includesScreenshot) add("No screenshot")
            if (notifyReporter) add("Notify me")
        }
        optionsSummary.text = parts.joinToString(" · ")
        optionsSummary.visibility = if (parts.isEmpty()) View.GONE else View.VISIBLE
    }

    // MARK: - Attachments

    /** A camera app must exist; if the host app declares CAMERA, it must also be granted (ACTION_IMAGE_CAPTURE throws otherwise). */
    private fun canTakePhoto(): Boolean =
        packageManager.hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY) &&
            Intent(MediaStore.ACTION_IMAGE_CAPTURE).resolveActivity(packageManager) != null

    private fun declaresCameraPermission(): Boolean = try {
        val info = packageManager.getPackageInfo(packageName, PackageManager.GET_PERMISSIONS)
        info.requestedPermissions?.contains(Manifest.permission.CAMERA) == true
    } catch (e: PackageManager.NameNotFoundException) {
        false
    }

    private fun pickFile() {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*")
        startSafely(intent, REQUEST_FILE)
    }

    private fun pickPhoto() {
        val intent = if (Build.VERSION.SDK_INT >= 33) {
            Intent(MediaStore.ACTION_PICK_IMAGES)
        } else {
            Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE).setType("image/*")
        }
        startSafely(intent, REQUEST_PHOTO)
    }

    private fun takePhoto() {
        if (declaresCameraPermission() && checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.CAMERA), REQUEST_CAMERA_PERMISSION)
            return
        }
        val file = FeedbackKitFileProvider.newPhotoFile(this)
        pendingPhotoFile = file
        val uri = FeedbackKitFileProvider.uriFor(this, file)
        val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
            .putExtra(MediaStore.EXTRA_OUTPUT, uri)
            .addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
        startSafely(intent, REQUEST_CAMERA)
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_CAMERA_PERMISSION && grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) takePhoto()
    }

    private fun startSafely(intent: Intent, requestCode: Int) {
        try {
            @Suppress("DEPRECATION")
            startActivityForResult(intent, requestCode)
        } catch (e: ActivityNotFoundException) {
            AlertDialog.Builder(this).setMessage("No app on this device can handle that.").setPositiveButton("OK", null).show()
        }
    }

    @Deprecated("Framework Activity result API; the SDK has no androidx dependency.")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        @Suppress("DEPRECATION")
        super.onActivityResult(requestCode, resultCode, data)
        if (resultCode != RESULT_OK) return
        when (requestCode) {
            REQUEST_FILE -> data?.data?.let { uri -> loadInBackground { readFileAttachment(uri) } }
            REQUEST_PHOTO -> data?.data?.let { uri -> loadInBackground { readPhotoAttachment(uri, displayName(uri)) } }
            REQUEST_CAMERA -> pendingPhotoFile?.let { file ->
                loadInBackground { readPhotoAttachment(Uri.fromFile(file), "Photo.jpg") }
            }
        }
    }

    private fun loadInBackground(load: () -> FeedbackAttachment?) {
        Http.executor.execute {
            val result = try { load() } catch (e: Exception) { null } catch (e: OutOfMemoryError) { null }
            runOnUiThread { if (result != null && !isFinishing) setAttachment(result) }
        }
    }

    private fun readFileAttachment(uri: Uri): FeedbackAttachment? {
        val bytes = contentResolver.openInputStream(uri)?.use { it.readBytes() } ?: return null
        val name = displayName(uri) ?: "Attachment"
        val mime = contentResolver.getType(uri) ?: "application/octet-stream"
        return FeedbackAttachment(name, mime, bytes)
    }

    /** A picked or taken photo as JPEG, its longest edge capped like the iOS SDK's, upright per EXIF. */
    private fun readPhotoAttachment(uri: Uri, suggestedName: String?): FeedbackAttachment? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return readFileAttachment(uri)
        var sample = 1
        while (max(bounds.outWidth, bounds.outHeight) / (sample * 2) >= AnnotationRenderer.MAX_PHOTO_PIXEL_DIMENSION) sample *= 2
        val decoded = contentResolver.openInputStream(uri)?.use {
            BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample })
        } ?: return null
        val orientation = contentResolver.openInputStream(uri)?.use {
            ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
        } ?: ExifInterface.ORIENTATION_NORMAL
        val upright = rotate(decoded, orientation)
        val scale = AnnotationRenderer.encodingScale(upright.width, upright.height, AnnotationRenderer.MAX_PHOTO_PIXEL_DIMENSION)
        val sized = if (scale < 1) {
            Bitmap.createScaledBitmap(upright, (upright.width * scale).roundToInt(), (upright.height * scale).roundToInt(), true)
        } else upright
        val out = ByteArrayOutputStream()
        sized.compress(Bitmap.CompressFormat.JPEG, 85, out)
        val base = suggestedName?.substringBeforeLast('.')?.takeIf { it.isNotBlank() } ?: "Photo"
        return FeedbackAttachment("$base.jpg", "image/jpeg", out.toByteArray())
    }

    private fun rotate(bitmap: Bitmap, orientation: Int): Bitmap {
        val degrees = when (orientation) {
            ExifInterface.ORIENTATION_ROTATE_90 -> 90f
            ExifInterface.ORIENTATION_ROTATE_180 -> 180f
            ExifInterface.ORIENTATION_ROTATE_270 -> 270f
            else -> return bitmap
        }
        return Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, Matrix().apply { postRotate(degrees) }, true)
    }

    private fun displayName(uri: Uri): String? = try {
        contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) cursor.getString(0) else null
        }
    } catch (e: Exception) {
        null
    }

    private fun setAttachment(value: FeedbackAttachment?) {
        attachment = value
        attachmentName.text = value?.filename
        attachmentChip.visibility = if (value == null) View.GONE else View.VISIBLE
    }

    // MARK: - Actions

    private fun presentTextPrompt(completion: (String?) -> Unit) {
        val field = EditText(this).apply {
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
            setSingleLine()
        }
        val frame = FrameLayout(this).apply {
            setPadding(palette.dp(20), palette.dp(8), palette.dp(20), 0)
            addView(field)
        }
        val dialog = AlertDialog.Builder(this)
            .setTitle("Add a note")
            .setView(frame)
            .setNegativeButton("Cancel") { _, _ -> completion(null) }
            .setPositiveButton("Add") { _, _ -> completion(field.text.toString()) }
            .setOnCancelListener { completion(null) }
            .create()
        dialog.setOnShowListener {
            field.requestFocus()
            dialog.window?.setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE)
        }
        dialog.show()
    }

    private fun hideKeyboard() {
        val imm = getSystemService(INPUT_METHOD_SERVICE) as InputMethodManager
        imm.hideSoftInputFromWindow(textInput.windowToken, 0)
        textInput.clearFocus()
    }

    private fun cancel() {
        hideKeyboard()
        deliver(null)
        finish()
    }

    @Deprecated("Framework back handling; predictive back falls through to onDestroy, which also delivers.")
    override fun onBackPressed() {
        cancel()
    }

    private fun submit() {
        hideKeyboard()
        sendButton.isEnabled = false
        sendButton.visibility = View.INVISIBLE
        progress.visibility = View.VISIBLE

        val text = textInput.text.toString()
        val include = includesScreenshot
        val annotations = if (include) canvasView.completedAnnotations else emptyList()
        val flattened = if (include) canvasView.flattenedImage() else null
        val screenshot = request.screenshot
        val products = FeedbackKit.products.filter { it.key in selectedProductKeys }
        val environment = EnvironmentInfo.current(applicationContext, request.screenName)
        val attachment = attachment
        val notify = notifyReporter

        // PNG encoding a full screenshot twice takes a moment — keep it off the main thread.
        Http.executor.execute {
            val raw = if (include) encodePng(screenshot) else null
            val annotated = flattened?.let { encodePng(it) }
            val report = FeedbackReport(
                text = text,
                screenshotRawPng = raw,
                screenshotAnnotatedPng = annotated,
                annotations = if (raw != null) annotations else emptyList(),
                environment = environment,
                attachment = attachment,
                products = products,
                notifyReporter = notify,
            )
            runOnUiThread {
                deliver(report)
                finish()
            }
        }
    }

    /** PNG with the longest edge capped at 1600px, the same budget as the iOS SDK. */
    private fun encodePng(bitmap: Bitmap): ByteArray? = try {
        val scale = AnnotationRenderer.encodingScale(bitmap.width, bitmap.height)
        val sized = if (scale < 1) {
            Bitmap.createScaledBitmap(bitmap, (bitmap.width * scale).roundToInt(), (bitmap.height * scale).roundToInt(), true)
        } else bitmap
        ByteArrayOutputStream().also { sized.compress(Bitmap.CompressFormat.PNG, 100, it) }.toByteArray()
    } catch (e: OutOfMemoryError) {
        null
    }

    private fun deliver(report: FeedbackReport?) {
        if (delivered) return
        delivered = true
        if (FeedbackSession.pending === request) FeedbackSession.pending = null
        request.onComplete(report)
    }

    override fun onDestroy() {
        super.onDestroy()
        if (!delivered && isFinishing) deliver(null)
    }

    override fun finish() {
        super.finish()
        @Suppress("DEPRECATION")
        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out)
    }

    private companion object {
        const val MENU_FILE = 1
        const val MENU_PHOTO = 2
        const val MENU_CAMERA = 3
        const val MENU_SCREENSHOT = 4
        const val MENU_NOTIFY = 5
        const val REQUEST_FILE = 0xFB01
        const val REQUEST_PHOTO = 0xFB02
        const val REQUEST_CAMERA = 0xFB03
        const val REQUEST_CAMERA_PERMISSION = 0xFB04
    }
}
