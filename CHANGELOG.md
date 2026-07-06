# Changelog

All notable changes to the Elias Web Console project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.0] — 2026-07-06

### Added

- Rate limiting with Zod validation for request payloads
- CI pipeline with coverage reporting
- SQLite-backed session store
- Helmet security headers
- `.env.example` and LICENSE files
- Feature system with OOP-based Feature classes (moved frontend to `platforms/app`)

### Changed

- Restructured project: frontend extracted to `platforms/app`, Feature system introduced

## [0.5.0] — 2026-07-06

### Added

- PWA support — manifest, service worker, app icon, and associated tests
- Mobile responsive layout

## [0.4.0] — 2026-07-05

### Added

- Homepage with AI greeting, chatbox, and widget system
- Collapsible sidebar with slide animation
- "Greeting" mode to auth fragment system
- Apple glassmorphism theme with light blue accent

### Changed

- Redesigned sidebar: removed title and lightning icon, logo bar acts as toggle-only trigger
- Floating sidebar — offset from edges, rounded corners, soft shadow
- Floating toggle — larger size, deeper shadow, hover scale-up effect
- Fluffy glass redesign — soft light-blue, high transparency

### Fixed

- Collapsed sidebar text clustering (overflow hidden approach)
- Aggressive collapsed sidebar overrides (`!important` removal)
- Sidebar toggle clipping resolved across all states:
  - Overflow hidden removed from collapsed sidebar
  - Overflow visible on sidebar, scroll confined to nav
  - Toggle positioned at right edge inside bar
  - Toggle repositioned to outside edge
  - Toggle unclipped with overflow:visible on sidebar

### Removed

- Sidebar title and lightning icon (logo bar now toggle-only)

## [0.3.0] — 2026-07-05

### Fixed

- Import paths corrected in web routes (4 levels up from routes/ directory)
- Double `shared.` prefix removed from `safeResolve` calls in vault route
- `safeResolve` now imported from shared module, local duplicate removed
- `SESSION_SECRET` handling hardened
- Lazy-load pattern consolidated
- `any` types fixed

## [0.2.0] — 2026-07-04

### Fixed

- `tsconfig.json` include path updated from `../elias/` to `../../eliasCore/`

## [0.1.0] — 2026-07-01

### Added

- Project README documenting the web console

## [0.0.1] — 2026-06-30

### Added

- Project scaffolding moved into `platforms/web/` directory
- Import paths updated to reference `eliasCore/`

[0.6.0]: https://github.com/periodicmango/elias/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/periodicmango/elias/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/periodicmango/elias/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/periodicmango/elias/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/periodicmango/elias/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/periodicmango/elias/compare/v0.0.1...v0.1.0
[0.0.1]: https://github.com/periodicmango/elias/releases/tag/v0.0.1
