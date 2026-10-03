plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
    `maven-publish`
}

android {
    namespace = "com.feedbackkit"
    compileSdk = 35

    defaultConfig {
        // PixelCopy's window variant (the screenshot path) is API 26; 24/25
        // fall back to drawing the view hierarchy. 24 matches React Native's floor.
        minSdk = 24
        consumerProguardFiles("consumer-rules.pro")
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }

    testOptions {
        unitTests.isReturnDefaultValues = true
    }

    publishing {
        singleVariant("release") {
            withSourcesJar()
        }
    }
}

// No runtime dependencies beyond the Kotlin stdlib on purpose: the UI is
// plain framework views and the transport is HttpURLConnection + org.json,
// so the AAR drops into any host (a Flutter or React Native app included)
// without dragging AppCompat/Compose/OkHttp versions along with it.
dependencies {
    testImplementation("junit:junit:4.13.2")
    // The real org.json, since android.jar's copy is a stub on the JVM.
    testImplementation("org.json:json:20240303")
}

publishing {
    publications {
        register<MavenPublication>("release") {
            groupId = "com.feedbackkit"
            artifactId = "feedbackkit-android"
            version = providers.gradleProperty("VERSION_NAME").get()
            afterEvaluate { from(components["release"]) }
            pom {
                name.set("FeedbackKit for Android")
                description.set("Capture a screenshot, annotate it, describe the problem, and get a structured FeedbackReport.")
                url.set("https://github.com/tianhaoz95/feedback-kit")
                licenses {
                    license {
                        name.set("MIT")
                        url.set("https://github.com/tianhaoz95/feedback-kit/blob/main/LICENSE")
                    }
                }
            }
        }
    }
}
