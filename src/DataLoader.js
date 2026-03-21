import Papa from 'papaparse';

// YOUR PUBLISHED CSV URL
const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT8uqvbrGAWt0EC9VAavWDFB51YEb30dVBAheKXG61PWEupxGL8qQLk1IUA51ERIImqlDjVzF3LR9on/pub?output=csv";

export const fetchLessons = () => {
  return new Promise((resolve, reject) => {
    Papa.parse(SHEET_URL, {
      download: true,
      header: true,
      complete: (results) => {
        // 1. Filter out empty rows (Google Sheets often adds them at the end)
        const validRows = results.data.filter(row => row.ID);

        // 2. Clean the data (using ; as the separator for your options)
        const cleanedData = validRows.map(row => ({
          ...row,
          Options: row.Options ? row.Options.split(';').map(opt => opt.trim()) : []
        }));

        // 3. Resolve the correctly named variable
        resolve(cleanedData);
      },
      error: (err) => reject(err)
    });
  });
};