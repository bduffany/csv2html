function numberRows() {
  const rows = document.querySelectorAll('tbody tr');
  let rowIndex = 0;
  for (const row of rows) {
    // Set data-row-index if not already set.
    if (row.dataset.rowIndex === 'undefined') {
      row.dataset.rowIndex = rowIndex;
      rowIndex++;
    } else {
      break;
    }
  }
}

function getDataType(columnIndex) {
  const rows = document.querySelectorAll('tbody tr');
  for (const row of rows) {
    const cell = row.children[columnIndex];
    if (!cell.textContent.match(/^\d+$/)) {
      return 'string';
    }
  }
  return 'number';
}

function sortBy(columnIndex) {
  // Populate data-row-index for all rows if we haven't already.
  numberRows();

  // Detect data type of sort column.
  const dataType = getDataType(columnIndex);

  // Get sort direction.
  const sortDir = document.querySelector('table').dataset.sortDir;
  // If already sorting on this column asc, then sort desc.
  // If already sorting on this column desc, then sort according to original order.
  let newSortDir = '';
  if (!sortDir) {
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
      return a.dataset.rowIndex - b.dataset.rowIndex;
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
