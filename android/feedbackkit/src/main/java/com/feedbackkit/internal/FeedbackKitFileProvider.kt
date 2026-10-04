package com.feedbackkit.internal

import android.content.ContentProvider
import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.OpenableColumns
import java.io.File
import java.io.FileNotFoundException

/**
 * Serves exactly one kind of file: the photo a camera app writes for the
 * composer's "Take Photo" (ACTION_IMAGE_CAPTURE needs a content:// URI to
 * write a full-size image). A tiny stand-in for androidx's FileProvider so
 * the SDK keeps no androidx dependency.
 */
internal class FeedbackKitFileProvider : ContentProvider() {
    companion object {
        private const val DIRECTORY = "feedbackkit-photos"

        fun authority(context: Context) = "${context.packageName}.feedbackkit-files"

        fun newPhotoFile(context: Context): File {
            val dir = File(context.cacheDir, DIRECTORY).apply { mkdirs() }
            dir.listFiles()?.forEach { it.delete() }
            return File(dir, "photo-${System.currentTimeMillis()}.jpg")
        }

        fun uriFor(context: Context, file: File): Uri =
            Uri.Builder().scheme("content").authority(authority(context)).appendPath(file.name).build()
    }

    private fun fileFor(uri: Uri): File {
        val context = context ?: throw FileNotFoundException()
        val name = uri.lastPathSegment ?: throw FileNotFoundException()
        // Only plain names inside our own directory — no path traversal.
        if (name.contains('/') || name.startsWith(".")) throw FileNotFoundException()
        return File(File(context.cacheDir, DIRECTORY), name)
    }

    override fun openFile(uri: Uri, mode: String): ParcelFileDescriptor =
        ParcelFileDescriptor.open(fileFor(uri), ParcelFileDescriptor.parseMode(mode))

    override fun query(uri: Uri, projection: Array<out String>?, selection: String?, selectionArgs: Array<out String>?, sortOrder: String?): Cursor {
        val file = fileFor(uri)
        return MatrixCursor(arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE)).apply {
            addRow(arrayOf<Any>(file.name, file.length()))
        }
    }

    override fun getType(uri: Uri): String = "image/jpeg"
    override fun onCreate(): Boolean = true
    override fun insert(uri: Uri, values: ContentValues?): Uri? = null
    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int = 0
    override fun update(uri: Uri, values: ContentValues?, selection: String?, selectionArgs: Array<out String>?): Int = 0
}
