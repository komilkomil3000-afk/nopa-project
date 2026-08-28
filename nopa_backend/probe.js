const XLSX = require('xlsx');
const fs = require('fs');

try {
  const wb = XLSX.readFile('شیت دوم.xlsx');
  console.log('Sheets:', wb.SheetNames);
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`\n--- ${sheetName} ---`);
    console.log('Headers:', data[0]);
    if (data.length > 1) {
      console.log('Row 1:', data[1]);
    }
  }
} catch (e) {
  console.error(e);
}
