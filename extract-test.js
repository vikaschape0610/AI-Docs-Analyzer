const fs = require('fs');
const pdf = require('pdf-parse');

const file = fs.readFileSync('C:\\Users\\VIKAS\\OneDrive\\ドキュメント\\Desktop\\Documents\\Aadhaar Card.pdf');
pdf(file).then(function(data) {
    console.log("Aadhaar text:\n", data.text);
});

const file2 = fs.readFileSync('C:\\Users\\VIKAS\\OneDrive\\ドキュメント\\Desktop\\Documents\\Pan card .pdf');
pdf(file2).then(function(data) {
    console.log("\nPAN text:\n", data.text);
});

const file3 = fs.readFileSync('C:\\Users\\VIKAS\\OneDrive\\ドキュメント\\Desktop\\Documents\\Income Certificate.pdf');
pdf(file3).then(function(data) {
    console.log("\nIncome text:\n", data.text);
});
