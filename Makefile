ASSETS := $(shell find assets -type f)
GO_SRCS := $(shell find . -type f -name "*.go")

csv2html: go.sum $(ASSETS) $(GO_SRCS)
	go build -o csv2html .

go.sum: go.mod
	go mod tidy

clean:
	rm -f csv2html
