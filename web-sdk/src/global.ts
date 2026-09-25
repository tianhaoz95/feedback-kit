// Entry for the `<script>`-tag (IIFE) build: exposes `window.FeedbackKit`,
// plus the renderer helpers under `window.FeedbackKit.renderer`.
import { FeedbackKit } from "./index";
import * as renderer from "./renderer";

export default Object.assign(FeedbackKit, { renderer });
