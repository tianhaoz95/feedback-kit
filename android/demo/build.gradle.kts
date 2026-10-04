plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.feedbackkit.demo"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.feedbackkit.demo"
        minSdk = 24
        targetSdk = 35
        // The fix-verification loop compares this to the build a fix shipped in;
        // release builds pass a UTC-timestamp build number like the iOS scripts do.
        versionCode = (project.findProperty("buildNumber") as String?)?.toInt() ?: 1
        versionName = providers.gradleProperty("VERSION_NAME").get()
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        compose = true
    }
}

dependencies {
    // The SDK from this repo, like DemoApp/project.yml points FeedbackKit at `..`.
    implementation(project(":feedbackkit"))

    implementation(platform("androidx.compose:compose-bom:2024.12.01"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.activity:activity-compose:1.9.3")
}
