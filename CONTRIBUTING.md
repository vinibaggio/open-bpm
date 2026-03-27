# Contributing to Blood Pressure Tracker

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

1. **Fork and clone** the repository:
   ```bash
   git clone https://github.com/<your-username>/bloodpressure.git
   cd bloodpressure
   npm install
   ```

2. **Start the dev server:**
   ```bash
   npm start
   ```

3. **Run on a device** (BLE features require a physical device):
   ```bash
   npx expo run:ios --device "Your Device Name"
   npx expo run:android --device
   ```

## Before Submitting a PR

Please make sure:

- [ ] `npm test` passes
- [ ] `npm run typecheck` passes
- [ ] You've tested on a physical device if your change involves BLE or native features
- [ ] Your commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) style

## Code Style

- TypeScript strict mode
- Functional components with hooks
- Prefix BLE debug logs with `[BLE:Sync]`, `[BLE:Protocol]`, or `[BLE:Parser]`

## Adding a New Blood Pressure Monitor

See the [README](README.md#adding-support-for-a-new-blood-pressure-monitor) for detailed instructions on adding support for a new BLE device.

## Reporting Bugs

Open an issue with:
- Device model and OS version
- Steps to reproduce
- Expected vs. actual behavior
- Relevant logs (Metro console output with `[BLE:*]` tags if BLE-related)

## Feature Requests

Open an issue describing the use case and proposed solution. Discussion before implementation is encouraged for larger changes.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
