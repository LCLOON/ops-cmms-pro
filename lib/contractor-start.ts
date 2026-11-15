// The contractor start gate lives in ./contractor-evidence so that module stays free of
// local imports and can be loaded directly by the Node test runner. Keeping one copy of
// the rules matters: a second implementation is how the status gates drifted apart.
export * from './contractor-evidence';





