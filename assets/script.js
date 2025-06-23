function optimizeColumnWidths(table) {
  table.classList.add('laying-out');
  // Set table-layout to auto to allow content-based sizing
  table.style.tableLayout = 'auto';

  // Find or create colgroup and ensure correct col count
  let colgroup = table.querySelector('colgroup');
  if (!colgroup) {
    colgroup = document.createElement('colgroup');
    table.insertBefore(colgroup, table.firstChild);
  }

  const rows = Array.from(table.rows);
  if (!rows.length) return;

  const numCols = Array.from(rows[0].children).length;

  // Ensure colgroup has the right number of <col> elements
  while (colgroup.children.length < numCols) {
    colgroup.appendChild(document.createElement('col'));
  }
  while (colgroup.children.length > numCols) {
    colgroup.removeChild(colgroup.lastChild);
  }

  const cols = Array.from(colgroup.children);
  // Reset existing widths before calculation
  cols.forEach((col) => {
    col.style.width = '';
  });

  // Calculate max content widths
  const colContentWidths = Array(numCols).fill(0);
  rows.forEach((row) => {
    Array.from(row.children).forEach((cell, i) => {
      // Use a lightweight clone for measurement to avoid layout shifts
      const cellClone = cell.cloneNode(true);
      cellClone.style.cssText =
        'position: absolute; visibility: hidden; white-space: nowrap;';
      document.body.appendChild(cellClone);
      colContentWidths[i] = Math.max(
        colContentWidths[i],
        cellClone.offsetWidth
      );
      document.body.removeChild(cellClone);
    });
  });

  // offsetWidth does not include right border, which is OK except for the last
  // column, so we subtract 1px to account for that.
  const targetWidth = document.scrollingElement.clientWidth - 1;
  const initialEqualWidth = targetWidth / numCols;

  let remainingExcessWhitespace = 0;

  // Get sorted column indexes in increasing order of content width.
  const sortedColumnIndexes = colContentWidths
    .map((_, i) => i)
    .sort((a, b) => colContentWidths[a] - colContentWidths[b]);
  const finalWidths = Array(numCols);
  for (let i = 0; i < numCols; i++) {
    let c = sortedColumnIndexes[i];
    if (colContentWidths[c] <= initialEqualWidth) {
      remainingExcessWhitespace += initialEqualWidth - colContentWidths[c];
      finalWidths[c] = colContentWidths[c];
      continue;
    }
    const columnsRemaining = numCols - i;
    const maxGrowth = remainingExcessWhitespace / columnsRemaining;
    const growth = Math.min(maxGrowth, colContentWidths[c] - initialEqualWidth);
    finalWidths[c] = Math.floor(initialEqualWidth + growth);
    remainingExcessWhitespace -= growth;
  }

  // Apply the final widths
  finalWidths.forEach((width, i) => {
    cols[i].style.width = `${width}px`;
  });
  // Finally, set table-layout to fixed to lock in the calculated widths.
  // This prevents the browser from overriding our calculations on window resize.
  table.style.tableLayout = 'fixed';
  table.classList.remove('laying-out');
}

function numberRows() {
  const rows = document.querySelectorAll('tbody tr');
  let rowIndex = 0;
  for (const row of rows) {
    // Set data-row-index if not already set.
    if (row.dataset.rowIndex === undefined) {
      row.dataset.rowIndex = rowIndex;
      rowIndex++;
    } else {
      break;
    }
  }
}

let dataTypeMemo = {};
function getDataType(columnIndex) {
  return (dataTypeMemo[columnIndex] ??= (() => {
    const rows = document.querySelectorAll('tbody tr');
    for (const row of rows) {
      const cell = row.children[columnIndex];
      if (!cell.textContent.match(/^\-?\d+(\.\d+)?$/)) {
        return 'string';
      }
    }
    return 'number';
  })());
}

function sortBy(columnIndex) {
  // Populate data-row-index for all rows if we haven't already.
  numberRows();

  // Detect data type of sort column.
  const dataType = getDataType(columnIndex);

  // Get sort direction.
  const sortDir = document.querySelector('table').dataset.sortDir;
  const sortColumn = document.querySelector('table').dataset.sortColumn;
  // If already sorting on this column asc, then sort desc.
  // If already sorting on this column desc, then sort according to original order.
  let newSortDir = '';
  if (
    !sortDir ||
    (sortColumn !== undefined && Number(sortColumn) !== columnIndex)
  ) {
    newSortDir = 'asc';
  } else if (sortDir === 'asc') {
    newSortDir = 'desc';
  } else {
    newSortDir = '';
  }

  // Sort rows.
  const rows = document.querySelectorAll('tbody tr');
  const sortedRows = [...rows].sort((a, b) => {
    if (!newSortDir) {
      return Number(a.dataset.rowIndex) - Number(b.dataset.rowIndex);
    }
    if (newSortDir === 'desc') {
      [a, b] = [b, a];
    }
    const aCell = a.children[columnIndex];
    const bCell = b.children[columnIndex];
    if (dataType === 'number') {
      return Number(aCell.textContent) - Number(bCell.textContent);
    }
    return aCell.textContent.localeCompare(bCell.textContent);
  });
  document.querySelector('table').dataset.sortDir = newSortDir;
  document.querySelector('table').dataset.sortColumn = columnIndex;
  document.querySelector('tbody').replaceChildren(...sortedRows);

  // Apply 'sort-column' class to the correct th element.
  document.querySelectorAll('th').forEach((th, i) => {
    if (i === columnIndex && newSortDir) {
      th.classList.add('sort-column');
    } else {
      th.classList.remove('sort-column');
    }
  });
}

document.querySelectorAll('th').forEach((th, i) => {
  th.addEventListener('click', (e) => {
    e.preventDefault();
    sortBy(i);
  });
});

// Add "numeric" class to all numeric columns.
document.querySelectorAll('th').forEach((th, i) => {
  if (getDataType(i) === 'number') {
    th.classList.add('numeric');
    for (const row of document.querySelectorAll('tbody tr')) {
      row.children[i].classList.add('numeric');
    }
  }
});

// Add keyboard shortcuts:
window.addEventListener('keydown', (e) => {
  // W toggles wrapping
  if (e.key === 'w') {
    const table = document.querySelector('table');
    const wrapping = table.classList.toggle('wrap');
    // If wrapping is enabled, insert <wbr> to improve browser's default wrapping behavior.
    if (wrapping) {
      for (const cell of table.querySelectorAll('th, td')) {
        walkTextNodes(cell, (node) => {
          node.parentNode.innerHTML = node.textContent.replaceAll(
            /([\/:])/g,
            '$1<wbr>'
          );
          return false;
        });
      }
    } else {
      const wbrs = table.querySelectorAll('wbr');
      for (const wbr of wbrs) {
        let nodeBefore = wbr.previousSibling;
        let nodeAfter = wbr.nextSibling;
        // Merge text nodes before and after the <wbr> into a single text node.
        if (
          nodeBefore?.nodeType === Node.TEXT_NODE &&
          nodeAfter?.nodeType === Node.TEXT_NODE
        ) {
          nodeBefore.textContent += wbr.textContent + nodeAfter.textContent;
          nodeAfter.remove();
        }
        wbr.remove();
      }
    }
  }
});

function walkTextNodes(node, callback) {
  const treeWalker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  while (treeWalker.nextNode()) {
    if (callback(treeWalker.currentNode)) {
      break;
    }
  }
}

document.querySelector('table').classList.add('laying-out');
window.addEventListener('load', () => {
  optimizeColumnWidths(document.querySelector('table'));
});
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    optimizeColumnWidths(document.querySelector('table'));
  }, 100);
});
