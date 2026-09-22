const XLSX = require('xlsx');

try {
  const wb = XLSX.readFile('شیت دوم.xlsx');
  const s04 = XLSX.utils.sheet_to_json(wb.Sheets['04'], { header: 1 });
  console.log('--- Sheet 04 (Mentors) ---');
  console.log(s04.slice(0, 5));

  const s02 = XLSX.utils.sheet_to_json(wb.Sheets['02'], { header: 1 });
  console.log('--- Sheet 02 (Caravans) ---');
  console.log(s02.slice(0, 5));

  const s01 = XLSX.utils.sheet_to_json(wb.Sheets['01'], { header: 1 });
  console.log('--- Sheet 01 (Users) ---');
  console.log(s01.slice(0, 10));

  const s06 = XLSX.utils.sheet_to_json(wb.Sheets['06'], { header: 1 });
  console.log('--- Sheet 06 (Assets) ---');
  console.log(s06.slice(0, 10));
} catch(e) { console.error(e); }
