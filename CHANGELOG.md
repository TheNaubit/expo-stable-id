## [2.0.2](https://github.com/TheNaubit/expo-stable-id/compare/v2.0.1...v2.0.2) (2026-09-29)


### Bug Fixes

* keep ids set during configure, sync stores in one runtime, and update cloud-settings ([c62eaca](https://github.com/TheNaubit/expo-stable-id/commit/c62eaca30dfb315b972a388bca9a1d7488ca3b74))
* share one app-wide store between StableIdProvider and the functional API ([8f99d8e](https://github.com/TheNaubit/expo-stable-id/commit/8f99d8ecb0e136a3427d112ae0440d552eef4f26))

## [2.0.1](https://github.com/TheNaubit/expo-stable-id/compare/v2.0.0...v2.0.1) (2026-09-29)


### Bug Fixes

* make configure idempotent under concurrency and harden stored-id handling ([ce6d1af](https://github.com/TheNaubit/expo-stable-id/commit/ce6d1af16ad615e504ee8f769ead44a760ad1661))

# [2.0.0](https://github.com/TheNaubit/expo-stable-id/compare/v1.0.3...v2.0.0) (2026-02-07)


### Features

* remove App Transaction ID feature and convert to pure JS module ([4de9584](https://github.com/TheNaubit/expo-stable-id/commit/4de95844614a20f7debb5b0f6ab1dc14aabe36f7))


### BREAKING CHANGES

* fetchAppTransactionId, useAppTransactionId, and
AppTransactionIdResult have been removed. Use expo-app-integrity
instead for app verification needs. Native modules (ios/, android/)
and expo-module.config.json have been removed.

## [1.0.3](https://github.com/TheNaubit/expo-stable-id/compare/v1.0.2...v1.0.3) (2026-02-07)


### Bug Fixes

* use expo-crypto instead of global crypto for React Native compatibility ([ce48ab7](https://github.com/TheNaubit/expo-stable-id/commit/ce48ab738743ed3cd9a9157aa024c2d56c8e3bc7))

## [1.0.2](https://github.com/TheNaubit/expo-stable-id/compare/v1.0.1...v1.0.2) (2026-02-07)


### Bug Fixes

* use getRandomValues instead of randomUUID for Hermes compatibility ([0a9481f](https://github.com/TheNaubit/expo-stable-id/commit/0a9481ff717c0dd89448a30df92f5c940632b97d))

## [1.0.1](https://github.com/TheNaubit/expo-stable-id/compare/v1.0.0...v1.0.1) (2026-02-06)


### Bug Fixes

* require expo-cloud-settings >=1.3.1 for iCloud entitlement fix ([1e5f477](https://github.com/TheNaubit/expo-stable-id/commit/1e5f4774bcd79528adbdc470bc52530a1a494c5a))

# 1.0.0 (2026-02-06)


### Bug Fixes

* normalize repository URL in package.json ([fd373b9](https://github.com/TheNaubit/expo-stable-id/commit/fd373b94764658c4c798405df9698e16510d4170))


### Features

* initial implementation of expo-stable-id ([caece0e](https://github.com/TheNaubit/expo-stable-id/commit/caece0e1470bcceed2d2f55d278884bf0ee776f7))
