package main

import (
	"encoding/csv"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"text/template"

	_ "embed"

	"github.com/fsnotify/fsnotify"
)

var (
	inputFile   = flag.String("input", "", "Input file. If not specified, stdin is used.")
	separator   = flag.String("separator", "", `CSV separator. Defaults to comma, unless -input has .tsv extension. Use '\t' for tab.`)
	header      = flag.Bool("header", true, "Use first row as header.")
	detectLinks = flag.Bool("detect_links", true, "Detect links in cells and wrap them in <a> tags.")

	serve = flag.String("serve", "", "Serve the HTML file at the given address instead of writing to stdout.")
	watch = flag.Bool("watch", true, "In serve mode, watch the input file for changes and re-render the HTML as it changes. Must use -input file path.")
)

//go:embed assets/template.html.tmpl
var templateHTML string

//go:embed assets/style.css
var styleCSS string

//go:embed assets/script.js
var scriptJS string

//go:embed assets/watch.js
var watchJS string

type TemplateData struct {
	Title   string
	CSS     string
	HTML    string
	JS      string
	WatchJS string
}

func main() {
	flag.Parse()
	if err := run(); err != nil {
		log.Fatal(err)
	}
}

func renderTemplate(w io.Writer) error {
	var r io.Reader = os.Stdin
	if *inputFile != "" {
		f, err := os.Open(*inputFile)
		if err != nil {
			return fmt.Errorf("open input file: %w", err)
		}
		defer f.Close()
		r = f
	}
	// Parse input as CSV.
	csvReader := csv.NewReader(r)
	comma := ""
	if *separator == "" && strings.HasSuffix(*inputFile, ".tsv") {
		comma = "\t"
	} else if *separator == "\\t" {
		comma = "\t"
	} else if *separator != "" {
		comma = *separator
	} else {
		comma = ","
	}
	if len(comma) != 1 {
		return fmt.Errorf("invalid separator %q: must be exactly one UTF-8 rune", *separator)
	}
	csvReader.Comma = rune(comma[0])

	var headerRow []string
	if *header {
		var err error
		headerRow, err = csvReader.Read()
		if err != nil {
			return fmt.Errorf("read header row: %w", err)
		}
	}
	// TODO: don't buffer all rows in memory. Set ReuseRecord to true as well to
	// reduce allocations.
	var rows [][]string
	for {
		row, err := csvReader.Read()
		if err != nil {
			if err == io.EOF {
				break
			}
			return fmt.Errorf("read row: %w", err)
		}
		rows = append(rows, row)
	}

	// Build <table> HTML.
	var h strings.Builder
	h.WriteString("<table>")
	if *header {
		h.WriteString("<thead>")
		for _, cell := range headerRow {
			h.WriteString("<th>")
			h.WriteString(`<span class="header-cell-content">`)
			h.WriteString(cell)
			h.WriteString("</span>")
			h.WriteString("</th>")
		}
		h.WriteString("</thead>")
	}
	h.WriteString("<tbody>")
	for _, row := range rows {
		h.WriteString("<tr>")
		for _, cell := range row {
			display := cell
			h.WriteString("<td>")
			if *detectLinks {
				if strings.HasPrefix(cell, "http://") || strings.HasPrefix(cell, "https://") {
					display = fmt.Sprintf(`<a href="%s">%s</a>`, cell, display)
				}
			}
			h.WriteString(display)
			h.WriteString("</td>")
		}
		h.WriteString("</tr>")
	}
	h.WriteString("</tbody>")
	h.WriteString("</table>")

	// Render template.
	tmpl, err := template.New("template").Parse(templateHTML)
	if err != nil {
		return fmt.Errorf("parse template: %w", err)
	}
	data := TemplateData{
		Title: "CSV to HTML",
		CSS:   styleCSS,
		HTML:  h.String(),
		JS:    scriptJS,
	}
	if *inputFile != "" {
		data.Title = filepath.Base(*inputFile)
	}
	if *serve != "" && *inputFile != "" && *watch {
		data.WatchJS = watchJS
	}
	if err := tmpl.Execute(w, data); err != nil {
		return fmt.Errorf("execute template: %w", err)
	}
	return nil
}

func run() error {
	if *serve == "" {
		if err := renderTemplate(os.Stdout); err != nil {
			return fmt.Errorf("render template: %w", err)
		}
		return nil
	}

	if *inputFile != "" && *watch {
		log.Printf("Watching %s for changes", *inputFile)
	}

	// Serve on the given address
	lis, err := net.Listen("tcp", *serve)
	if err != nil {
		return fmt.Errorf("listen: %w", err)
	}
	defer lis.Close()

	if *inputFile != "" && *watch {
		http.HandleFunc("/watch", func(w http.ResponseWriter, r *http.Request) {
			watcher, err := fsnotify.NewWatcher()
			if err != nil {
				http.Error(w, fmt.Sprintf("create watcher: %v", err), http.StatusInternalServerError)
				return
			}
			defer watcher.Close()
			if err := watcher.Add(*inputFile); err != nil {
				http.Error(w, fmt.Sprintf("add file to watcher: %v", err), http.StatusInternalServerError)
				return
			}
			for {
				select {
				case event := <-watcher.Events:
					log.Printf("File changed (%s)", event.Op)

					s, err := os.Stat(*inputFile)
					// If the file doesn't exist, it's probably being replaced.
					if os.IsNotExist(err) {
						continue
					}
					if err != nil {
						http.Error(w, fmt.Sprintf("stat file: %v", err), http.StatusInternalServerError)
						return
					}
					// If the file is empty, it probably just got truncated and is
					// actively being rewritten. Ignore the event.
					if s.Size() == 0 {
						continue
					}

					w.Write([]byte("OK"))
					return
				case <-watcher.Errors:
					http.Error(w, fmt.Sprintf("watcher error: %v", err), http.StatusInternalServerError)
					return
				case <-r.Context().Done():
					return
				}
			}
		})
	}
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if err := renderTemplate(w); err != nil {
			http.Error(w, fmt.Sprintf("render template: %v", err), http.StatusInternalServerError)
			return
		}
	})
	log.Printf("Serving on %s", *serve)
	http.Serve(lis, nil)
	return nil
}
