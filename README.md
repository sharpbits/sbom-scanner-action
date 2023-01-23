# SBOM Scanner Action

Scan all repos in a Github/GHES organization and produce a software bill-of-material report in the form of a JSON datafile.

In addition to a standard set of manifest and github data, this action provides a set of scanners to enrich the metadata available for each repo.

The generated datafile can be read and visualized by the [SBOM Report Tool](https://github.com/sharpbits/sbom-report)

## Usage

### Scanners

* Manifest
  * Gather basic information about the technology and configuration of a repository
  * Looks at Github configuration, manifest file, and Dockerfile
* Jenkins
  * Gather basic build information for the master branch including test status and code coverage
* Veracode
  * Gather static analysis scan status and results
* Veracode SCA
  * Gather Software Composition Analysis status and results

## Limitations

To yield the smallest, most portable action this repo uses esbuild to compile the source into a CommonJS module. Between this and limitations with the Github Action runtime there are some limitations with no current workaround.

1. It isn't possible to make this action truly extensible, such as dynamically extending the set of available scanners in the repository that is consuming this action.
2. Scanners attempting to make use of libraries with compiled binary dependencies are going to have a bad time.

## Build and deploy

Set up: `npm i`

Test: `npm test`

Package: `npm run dist`

Note: Always run `npm run dist` prior to committing any changes. This will update the build used by downstream actions. In a future enhancement, this will be handled in a Github release action.

## Contributing

Fork and open a PR to the `dev` branch. Describe the changes in detail and demonstrate testability.

The default `main` branch is automatically updated on merged to `dev` by a Github Action which will also build, test and package the action.
