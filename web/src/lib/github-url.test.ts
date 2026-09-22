import test from "node:test";
import assert from "node:assert/strict";
import { extractRepo } from "./github-url.ts";

test("extractRepo parses owner/repo format", () => {
  assert.deepEqual(extractRepo("tianhaoz95/feedback-kit"), {
    owner: "tianhaoz95",
    repo: "feedback-kit",
  });
  assert.deepEqual(extractRepo("octocat/Hello-World"), {
    owner: "octocat",
    repo: "Hello-World",
  });
  assert.deepEqual(extractRepo("  org-name/repo_name.1  "), {
    owner: "org-name",
    repo: "repo_name.1",
  });
});

test("extractRepo parses HTTPS GitHub URLs", () => {
  assert.deepEqual(extractRepo("https://github.com/facebook/react"), {
    owner: "facebook",
    repo: "react",
  });
  assert.deepEqual(extractRepo("https://github.com/facebook/react/"), {
    owner: "facebook",
    repo: "react",
  });
  assert.deepEqual(extractRepo("https://github.com/facebook/react.git"), {
    owner: "facebook",
    repo: "react",
  });
  assert.deepEqual(extractRepo("https://github.com/facebook/react/issues/123"), {
    owner: "facebook",
    repo: "react",
  });
  assert.deepEqual(extractRepo("https://github.com/facebook/react/pull/456#discussion_r123"), {
    owner: "facebook",
    repo: "react",
  });
});

test("extractRepo parses SSH GitHub URLs", () => {
  assert.deepEqual(extractRepo("git@github.com:facebook/react.git"), {
    owner: "facebook",
    repo: "react",
  });
  assert.deepEqual(extractRepo("git@github.com:tianhaoz95/feedback-kit"), {
    owner: "tianhaoz95",
    repo: "feedback-kit",
  });
});

test("extractRepo returns null for invalid inputs", () => {
  assert.equal(extractRepo(""), null);
  assert.equal(extractRepo("   "), null);
  assert.equal(extractRepo("just-a-name"), null);
  assert.equal(extractRepo("too/many/parts/here"), null);
  assert.equal(extractRepo("https://google.com/search"), null);
});
