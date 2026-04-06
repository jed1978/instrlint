# Components Sub-directory Instructions

This file applies specifically to all code under src/components/.

- Follow atomic design: atoms → molecules → organisms → templates → pages.
- Each component lives in its own directory with an index.ts barrel export.
- Co-locate styles as ComponentName.module.css.
- Co-locate tests as ComponentName.test.tsx.
- Export props interface as `ComponentNameProps`.
