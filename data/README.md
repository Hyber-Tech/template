# Data Directory

## Overview
The `data/` directory holds all data files that the project uses or generates. This can include databases, data dumps, or any machine-readable data sets.

## Structure
- **raw/**: Unprocessed data files.
- **processed/**: Data that has been cleaned or manipulated ready for analysis or production use.

## Guidelines
- Ensure that sensitive information is scrubbed or anonymized before pushing to this repository.
- Maintain a README in each subfolder to describe the data it contains and any relevant processing steps taken.

## Usage
Data files in this directory should be referenced in scripts or code by relative paths. Ensure data access paths are correctly set up in your code configurations.
