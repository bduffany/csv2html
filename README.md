# csv2html

Converts CSV data to an interactive spreadsheet-like HTML UI.

Features:

- Sorting: click column header to sort.
- Optimized table layout: uses an algorithm to set column widths in a way that maximizes information density.
- Web server mode: watch a local file for changes and automatically reload it in the browser.

## Installation

```shell
go install github.com/bduffany/csv2html@latest
```

## Usage

```shell
# See all available flags
csv2html -help

# Generate HTML from a CSV file
cat data.csv | csv2html > data.html

# Generate HTML from a TSV file (tab-separated)
csv2html -input data.tsv > data.html

# Watch a file for changes (Web server mode - visible at http://localhost:8282)
csv2html -input data.csv -serve :8282
```
