const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const ExcelJS = require("exceljs");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use("/uploads", express.static("uploads"));

const ADMIN_EMAIL = "bujji6728@gmail.com";
let registrations = [];

/* ===== Multer setup for image upload ===== */
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, "uploads/"),
    filename: (req, file, cb) =>
        cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

/* ===== Email Setup ===== */
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'your-email@gmail.com',
        pass: 'your-email-password'
    }
});

/* ===== Send QR Mail ===== */
async function sendQRMail(to, qrDataUrl, scanUrl) {
    // Configure your SMTP details here
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'YOUR_GMAIL@gmail.com',
            pass: 'YOUR_APP_PASSWORD'
        }
    });

    await transporter.sendMail({
        from: '"Event Team" <YOUR_GMAIL@gmail.com>',
        to,
        subject: "Your Event QR Code",
        html: `<p>Thank you for registering!<br>
               Please present this QR code at the event for attendance.<br>
               <img src="${qrDataUrl}" /><br>
               Or use this link: <a href="${scanUrl}">${scanUrl}</a></p>`
    });
}

/* ===== Register Team ===== */
app.post("/register", upload.single("screenshot"), async (req, res) => {
    const data = JSON.parse(req.body.data);

    // Enforce EXACTLY 5 members
    if (data.members.length !== 4) {
        return res.status(400).send("Team must have exactly 5 members");
    }

    // Generate unique registration ID
    const regId = uuidv4();

    // Generate QR code with scan URL
    const scanUrl = `http://localhost:3000/scan?id=${regId}`;
    const qrDataUrl = await QRCode.toDataURL(scanUrl);

    registrations.push({
        id: regId,
        teamName: data.team,
        leader: data.leader,
        members: data.members,
        txn: data.txn,
        screenshot: req.file ? req.file.filename : "",
        scanned: false
    });

    // Send email with QR code
    await sendQRMail(data.leader.email, qrDataUrl, scanUrl);

    res.json({ message: "Team Registered Successfully" });
});

/* ===== Download Excel (ADMIN ONLY) ===== */
app.get("/download", async (req, res) => {
    if (req.query.email !== ADMIN_EMAIL) {
        return res.status(403).send("Access Denied");
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Attendance");

    sheet.columns = [
        { header: "Team Name", key: "team", width: 20 },
        { header: "Leader Name", key: "lname", width: 20 },
        { header: "Leader Email", key: "lemail", width: 25 },
        { header: "Leader Mobile", key: "lmobile", width: 15 },
        { header: "Leader Reg No", key: "lreg", width: 18 },
        { header: "Transaction ID", key: "txn", width: 25 },
        { header: "Scanned", key: "scanned", width: 10 }
    ];

    registrations.filter(r => r.scanned).forEach(t => {
        sheet.addRow({
            team: t.teamName,
            lname: t.leader.name,
            lemail: t.leader.email,
            lmobile: t.leader.mobile,
            lreg: t.leader.reg,
            txn: t.txn,
            scanned: t.scanned ? "Yes" : "No"
        });
    });

    res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
        "Content-Disposition",
        "attachment; filename=Attendance.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
});

/* ===== Download All Registrations (ADMIN ONLY) ===== */
app.get("/download-registrations", async (req, res) => {
    if (req.query.email !== ADMIN_EMAIL) {
        return res.status(403).send("Access Denied");
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Registrations");

    sheet.columns = [
        { header: "Team Name", key: "team", width: 20 },
        { header: "Leader Name", key: "lname", width: 20 },
        { header: "Leader Email", key: "lemail", width: 25 },
        { header: "Leader Mobile", key: "lmobile", width: 15 },
        { header: "Leader Reg No", key: "lreg", width: 18 },
        { header: "Transaction ID", key: "txn", width: 25 },
        { header: "Scanned", key: "scanned", width: 10 }
    ];

    registrations.forEach(t => {
        sheet.addRow({
            team: t.teamName,
            lname: t.leader.name,
            lemail: t.leader.email,
            lmobile: t.leader.mobile,
            lreg: t.leader.reg,
            txn: t.txn,
            scanned: t.scanned ? "Yes" : "No"
        });
    });

    res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
        "Content-Disposition",
        "attachment; filename=All_Registrations.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
});

/* ===== Scan QR Code ===== */
app.get("/scan", (req, res) => {
    const { id } = req.query;
    const reg = registrations.find(r => r.id === id);
    if (!reg) return res.send("Invalid QR code.");
    if (reg.scanned) return res.send("Already scanned!");
    reg.scanned = true;
    res.send("Attendance marked! Welcome.");
});

/* ===== Home Route ===== */
app.get("/", (req, res) => {
    res.send("Backend is running!");
});

/* ===== Server Start ===== */
app.listen(3000, () =>
    console.log("✅ Backend running at http://localhost:3000")
);
