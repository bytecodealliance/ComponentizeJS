# Changelog

## [0.18.4] - 2025-07-23

### 🚀 Features

* update weval to v0.3.4 (#267) by @vados-cosmonic in #267


### 🐛 Bug Fixes

* logic for stubbing outgoing http and fetch-event (#268) by @vados-cosmonic in #268

* reuse feature list for CLI, add 'fetch-event' (#269) by @vados-cosmonic in #269

* remove log during realloc (#273) by @vados-cosmonic in #273

* *(tests)* responseOutparam usage (#271) by @vados-cosmonic in #271

* *(ci)* release changelog generation (#263) by @vados-cosmonic in #263

* *(ci)* create rc releases as prerelease (#264) by @vados-cosmonic in #264


### 🚜 Refactor

* 'features' -> 'feature' in WIT & Rust component (#270) by @vados-cosmonic in #270

* *(tests)* refactor expected globals test (#262) by @vados-cosmonic in #262


### ⚙️ Miscellaneous Tasks

* update StarlingMonkey to commit 1f6f81f (#260) by @vados-cosmonic in #260

* *(docs)* add comments to API type in README (#261) by @vados-cosmonic in #261




## [0.18.4-rc.1] - 2025-07-22

### 🚀 Features

* update weval to v0.3.4 (#267) by @vados-cosmonic in #267


### 🐛 Bug Fixes

* logic for stubbing outgoing http and fetch-event (#268) by @vados-cosmonic in #268

* reuse feature list for CLI, add 'fetch-event' (#269) by @vados-cosmonic in #269

* remove log during realloc (#273) by @vados-cosmonic in #273

* *(tests)* responseOutparam usage (#271) by @vados-cosmonic in #271


### 🚜 Refactor

* 'features' -> 'feature' in WIT & Rust component (#270) by @vados-cosmonic in #270




## [0.18.4-rc.0] - 2025-07-21

## Important Updates

This release contains an update to [StarlingMonkey][sm], the engine that powers `componentize-js`.
Important new features and bugfixes from StarlingMonkey relevant to `componentize-js` that are
pulled in by this update are listed below:

- Implement `EventTarget` and `Event` builtin ([#220](https://github.com/bytecodealliance/StarlingMonkey/pull/220))
- Add support for two-argument `has` and `delete` in `URLSearchParams` ([#236](https://github.com/bytecodealliance/StarlingMonkey/pull/236)) 

[sm]: https://github.com/bytecodealliance/StarlingMonkey

### 🐛 Bug Fixes

* *(ci)* release changelog generation (#263) by @vados-cosmonic in #263

* *(ci)* create rc releases as prerelease (#264) by @vados-cosmonic in #264


### 🚜 Refactor

* *(tests)* refactor expected globals test (#262) by @vados-cosmonic in #262


### ⚙️ Miscellaneous Tasks

* update StarlingMonkey to commit 1f6f81f (#260) by @vados-cosmonic in #260

* *(docs)* add comments to API type in README (#261) by @vados-cosmonic in #261




## [0.18.3] - 2025-07-16

### 🚀 Features

* *(ci)* add release automation (#226) by @vados-cosmonic in #226

### 🐛 Bug Fixes

* allow for use of both manual & fetchEvent based HTTP (#247) by @vados-cosmonic in #247

* makefile dep for splicer component (#251) by @vados-cosmonic in #251

* add repository.url to package.json (#243) by @vados-cosmonic in #243

* (ci) npm release artifact (#241) by @vados-cosmonic in #241

* (ci) NPM public access release (#239) by @vados-cosmonic in #239

* (ci) remove packages prefix (#232) by @vados-cosmonic in #232

* (ci) remove if for JS projects (#231) by @vados-cosmonic in #231

* (ops) add CHANGELOG.md (#229) by @vados-cosmonic in #229

* do not skip wasi:http export processing (#218) by @vados-cosmonic in #218

* (ci) use a local test server for fetch test (#207) by @vados-cosmonic in #207

### 🚜 Refactor

* splicer WIT and generated bindings (#252) by @vados-cosmonic in #252

* componentize code (#203) by @vados-cosmonic in #203

* (splicer) add explicit error for invalid WIT source (#219) by @vados-cosmonic in #219

### ⚙️ Miscellaneous Tasks

* *(ci)* add clippy (#248) by @vados-cosmonic in #248

* add CHANGELOG.md (#227) by @vados-cosmonic in #227

* (deps) update upstream wasm deps to *.227.1 (#204) by @vados-cosmonic in #204


## [0.18.3-rc.6] - 2025-07-14

### 🐛 Bug Fixes

* allow for use of both manual & fetchEvent based HTTP (#247) by @vados-cosmonic in #247

* makefile dep for splicer component (#251) by @vados-cosmonic in #251


### 🚜 Refactor

* splicer WIT and generated bindings (#252) by @vados-cosmonic in #252


### ⚙️ Miscellaneous Tasks

* *(ci)* add clippy (#248) by @vados-cosmonic in #248




## [0.18.3-rc.5] - 2025-07-08

### 🐛 Bug Fixes

* add repository.url to package.json (#243) by @vados-cosmonic in #243




## [0.18.3-rc.4] - 2025-07-08

### 🐛 Bug Fixes

* *(ci)* npm release artifact (#241) by @vados-cosmonic in #241




## [0.18.3-rc.3] - 2025-07-07

### 🐛 Bug Fixes

* *(ci)* NPM public access release (#239) by @vados-cosmonic in #239




## [0.18.3-rc.2] - 2025-07-07



## [0.18.3-rc.1] - 2025-06-30

### 🐛 Bug Fixes

* *(ci)* remove packages prefix (#232) by @vados-cosmonic in #232

* *(ci)* remove if for JS projects (#231) by @vados-cosmonic in #231




## [0.18.3-rc.0] - 2025-06-27

### 🚀 Features

* *(ci)* add release automation (#226) by @vados-cosmonic in #226


### 🐛 Bug Fixes

* *(ops)* add CHANGELOG.md (#229) by @vados-cosmonic in #229

* do not skip wasi:http export processing (#218) by @vados-cosmonic in #218

* *(ci)* use a local test server for fetch test (#207) by @vados-cosmonic in #207


### 🚜 Refactor

* componentize code (#203) by @vados-cosmonic in #203

* *(splicer)* add explicit error for invalid WIT source (#219) by @vados-cosmonic in #219


### ⚙️ Miscellaneous Tasks

* add CHANGELOG.md (#227) by @vados-cosmonic in #227

* *(deps)* update upstream wasm deps to *.227.1 (#204) by @vados-cosmonic in #204


## [0.18.2] - 2025-04-09
