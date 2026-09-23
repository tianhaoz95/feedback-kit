# Contributing Guidelines

Thank you for contributing to FeedbackKit! We welcome contributions to the Swift SDK, web dashboard, CLI, Supabase backend, Agent Skills, and documentation.

---

## Code of Conduct

All contributors and participants must adhere to our [Code of Conduct](https://github.com/tianhaoz95/feedback-kit/blob/main/CODE_OF_CONDUCT.md). Please be welcoming, respectful, and constructive.

---

## Pull Request Process

1. **Fork and Branch**: Create a feature branch off `main` (e.g. `feat/pen-stroke-smoothing` or `fix/mac-cursor-hover`).
2. **Follow Platform Rules**:
   - iOS-specific code must be gated with `#if os(iOS)`.
   - macOS code must live in `+macOS.swift` files gated with `#if os(macOS)`.
   - Keep shared drawing code in `AnnotationRenderer.swift` using `CGContext`.
3. **Verify Locally**:
   - Run tests: `swift test`, `cd web && npm test`, `cd cli && npm test`.
   - Validate skills: `npm run validate`.
4. **Submit PR**: Open a pull request against `main`. Ensure the PR description explains the motivation, implementation details, and screenshots/recordings for UI changes.

---

## Architectural Checklist Before Submitting

- [ ] Does this change preserve the decoupling between the SDK and the dashboard?
- [ ] If changing the report model, did you update `FeedbackReport.swift`, `IngestPayload`, Edge Functions, and web types?
- [ ] Are annotations still stored in normalized `0.0...1.0` coordinates?
- [ ] Are demo apps updated in `DemoApp/project.yml` instead of the generated `.xcodeproj`?
- [ ] Did you avoid introducing permission-requiring screenshot APIs?
