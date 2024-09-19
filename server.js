const { google } = require('googleapis');
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config(); // Load environment variables

// Initialize Express app
const app = express();
const port = 3000;

// Load credentials and spreadsheet ID from environment variables
const credentials = require(process.env.GOOGLE_APPLICATION_CREDENTIALS);
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

// Google Sheets API
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const auth = new google.auth.GoogleAuth({
    credentials: credentials,
    scopes: SCOPES
});

const SHEET_NAME_STUDENTS_OLD = 'Trang tính1';
const SHEET_NAME_STUDENTS_NEW = 'Trang tính2';

app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/submit', async (req, res) => {
    const { studentId } = req.body;

    if (!studentId) {
        return res.status(400).json({ message: 'Student ID is required.' });
    }

    try {
        const client = await auth.getClient();
        const sheets = google.sheets({ version: 'v4', auth: client });
        const sheetsNames = [SHEET_NAME_STUDENTS_OLD, SHEET_NAME_STUDENTS_NEW];

        for (const sheetName of sheetsNames) {
            const studentResponse = await sheets.spreadsheets.values.get({
                spreadsheetId: SPREADSHEET_ID,
                range: `${sheetName}!A:C`,
            });

            const students = studentResponse.data.values || [];
            const studentIndex = students.findIndex(row => row[1] === studentId);

            if (studentIndex !== -1) {
                await sheets.spreadsheets.batchUpdate({
                    spreadsheetId: SPREADSHEET_ID,
                    requestBody: {
                        requests: [
                            {
                                repeatCell: {
                                    range: {
                                        sheetId: await getSheetIdByName(sheetName),
                                        startRowIndex: studentIndex,
                                        endRowIndex: studentIndex + 1,
                                        startColumnIndex: 0,
                                        endColumnIndex: 3
                                    },
                                    cell: {
                                        userEnteredFormat: {
                                            backgroundColor: {
                                                red: 0.8,
                                                green: 1,
                                                blue: 0.8
                                            }
                                        }
                                    },
                                    fields: 'userEnteredFormat.backgroundColor'
                                }
                            }
                        ]
                    }
                });

                return res.json({ message: 'Attendance submitted and highlighted successfully!' });
            }
        }

        return res.status(400).json({ message: 'Student ID not found in any list.' });
    } catch (error) {
        console.error('Error writing to Google Sheets:', error);
        res.status(500).json({ message: 'Error writing to Google Sheets.' });
    }
});

async function getSheetIdByName(sheetName) {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });
    const response = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });

    const sheet = response.data.sheets.find(s => s.properties.title === sheetName);
    if (sheet) {
        return sheet.properties.sheetId;
    } else {
        throw new Error(`Sheet "${sheetName}" not found.`);
    }
}

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
