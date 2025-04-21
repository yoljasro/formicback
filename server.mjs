
import express from "express";
import axios from "axios";
import fs from "fs";
import cors from "cors"
import dotenv from "dotenv";

dotenv.config();
const app = express();
const PORT = 4000;

app.use(express.json());
app.use(cors())

let accessToken = process.env.AMOCRM_ACCESS_TOKEN;
let refreshToken = process.env.AMOCRM_REFRESH_TOKEN;

// Tokenni faylga saqlash
const saveTokens = (newAccessToken, newRefreshToken) => {
  accessToken = newAccessToken;
  refreshToken = newRefreshToken;

  // .env faylni yangilash
  const envContent = `
AMOCRM_ACCESS_TOKEN=${newAccessToken}
AMOCRM_REFRESH_TOKEN=${newRefreshToken}
AMOCRM_BASE_URL=${process.env.AMOCRM_BASE_URL}
CLIENT_ID=${process.env.CLIENT_ID}
CLIENT_SECRET=${process.env.CLIENT_SECRET}
REDIRECT_URI=${process.env.REDIRECT_URI}
`;

  fs.writeFileSync(".env", envContent.trim());
  console.log("🔄 Tokenlar yangilandi va .env faylga yozildi.");
};

// Access tokenni yangilash
const refreshAccessToken = async () => {
  try {
    const response = await axios.post(`${process.env.AMOCRM_BASE_URL}/oauth2/access_token`, {
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      redirect_uri: process.env.REDIRECT_URI,
    });

    saveTokens(response.data.access_token, response.data.refresh_token);
    return response.data.access_token;
  } catch (error) {
    console.error("❌ Refresh token bilan xatolik:", error.response?.data || error.message);
    throw error;
  }
};

// Lead va kontaktni amoCRM ga yuborish
const sendToAmoCRM = async (name, phone) => {
  try {
    const response = await axios.post(
      `${process.env.AMOCRM_BASE_URL}/api/v4/leads/complex`,
      [
        {
          name: `Yangi mijoz: ${name}`,
          _embedded: {
            contacts: [
              {
                first_name: name,
                custom_fields_values: [
                  {
                    field_code: "PHONE",
                    values: [{ value: phone }],
                  },
                ],
              },
            ],
          },
        },
      ],
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data;
  } catch (error) {
    // Token muddati tugagan bo'lishi mumkin
    if (error.response && error.response.status === 401) {
      console.log("🔐 Access token eskirgan, yangilanmoqda...");
      const newToken = await refreshAccessToken();
      return sendToAmoCRM(name, phone); // Qayta urinib ko‘ramiz
    }

    throw error;
  }
};

// API route
app.post("/api/send-to-amocrm", async (req, res) => {
  const { name, phone } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: "Iltimos, ism va telefon raqamini kiriting." });
  }

  try {
    const result = await sendToAmoCRM(name, phone);
    res.status(200).json({ success: true, result });
  } catch (error) {
    console.error("❌ Yuborishda xatolik:", error.response?.data || error.message);
    res.status(500).json({ error: "AmoCRM bilan ulanishda xatolik." });
  }
});

// Serverni ishga tushurish
app.listen(PORT, () => {
  console.log(`🚀 Server ishga tushdi: http://localhost:${PORT}`);
});
