group = "com.feedbackkit.flutter"
version = "1.0.62"

buildscript {
    val kotlinVersion = "2.4.0"
    repositories {
        google()
        mavenCentral()
    }

    dependencies {
        classpath("com.android.tools.build:gradle:9.1.0")
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlinVersion")
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

plugins {
    id("com.android.library")
}

// The plugin runs the real native Android SDK, compiled straight into this
// module: from android/feedbackkit in this repo when building inside it (the
// demo app, CI), or from the copy tool/vendor_native_sdks.sh places under
// src/vendor before `flutter pub publish`. One code path either way, and no
// Maven artifact for apps to resolve.
val repoSdk = file("../../../android/feedbackkit/src/main")
val nativeSdk = if (repoSdk.exists()) repoSdk else file("src/vendor/feedbackkit")

android {
    // The SDK's own namespace, since its sources (and their R references) compile here.
    namespace = "com.feedbackkit"

    compileSdk = 36

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    sourceSets {
        getByName("main") {
            java.srcDirs("src/main/kotlin", "${nativeSdk}/java")
            res.srcDirs("${nativeSdk}/res")
            // The SDK's manifest declares its editor activity and providers.
            manifest.srcFile("${nativeSdk}/AndroidManifest.xml")
        }
    }

    defaultConfig {
        minSdk = 24
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}
