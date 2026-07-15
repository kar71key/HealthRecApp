# 🩺 HealthRec

An **offline-first Android health tracking application** built with **React Native** that helps users monitor their daily health, nutrition, and physical activity. HealthRec combines local data storage with cloud synchronization and AI-powered features to provide a seamless health management experience.

> **Note:** This project was developed as a final-year B.Tech (Computer Science & Engineering) project.

---

## ✨ Features

* 🔐 Secure user authentication using Supabase Auth
* 📊 Dashboard for tracking daily health metrics
* 🚶 Step tracking using Android's native `TYPE_STEP_COUNTER` sensor
* 🍽️ Food logging with nutritional information
* 🤖 AI-powered food recognition
* 🧠 AI-assisted nutrition analysis
* 💧 Hydration tracking
* 😴 Sleep quality tracking
* 😊 Mood tracking
* 🩺 Symptom checker
* 📈 Personalized health insights based on historical data
* ☁️ Cloud synchronization with offline support
* 📱 Offline-first architecture using SQLite

---

## 🛠️ Tech Stack

### Frontend

* React Native (CLI)
* TypeScript

### Local Storage

* SQLite

### Backend

* Supabase Authentication
* PostgreSQL
* Row Level Security (RLS)

### AI Services

* FatSecret Image Recognition API
* Google Gemini API
* Hugging Face Inference API

### Native Android

* Kotlin
* Android Sensor Framework (`TYPE_STEP_COUNTER`)

---

## 🏗️ Architecture

HealthRec follows an **offline-first** architecture.

```text
                User
                  │
                  ▼
          React Native App
                  │
      ┌───────────┴───────────┐
      │                       │
      ▼                       ▼
  SQLite Database      Native Android
      │                 Step Counter
      │
      ▼
   Sync Queue
      │
      ▼
   Supabase Backend
      │
      ▼
 PostgreSQL Database
```

This design allows users to continue using the application even without an internet connection. Data is stored locally and synchronized with the cloud when connectivity is restored.

---

## 🚀 Getting Started

### Prerequisites

* Node.js
* npm or Yarn
* React Native CLI
* Android Studio
* JDK 17 or later

### Installation

```bash
git clone https://github.com/your-username/HealthRec.git

cd HealthRec

npm install
```

Start Metro:

```bash
npm start
```

Run on Android:

```bash
npm run android
```

---

## 🔑 Environment Variables

Create a `.env` file and configure the required environment variables.

Example:

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
GEMINI_API_KEY=
FATSECRET_CLIENT_ID=
FATSECRET_CLIENT_SECRET=
HUGGINGFACE_API_KEY=
```

---

## 📁 Project Structure

```text
HealthRec/
├── android/
├── src/
│   ├── components/
│   ├── screens/
│   ├── services/
│   ├── database/
│   ├── navigation/
│   ├── hooks/
│   ├── utils/
│   └── assets/
├── package.json
└── README.md
```

---

## 🎯 Future Improvements

* Apple Health integration
* Google Fit / Health Connect synchronization
* Medication reminders
* Wearable device support
* Advanced analytics and health trends
* Enhanced AI-driven recommendations

---

## 📄 License

This project is intended for educational and learning purposes.

---

## 👨‍💻 Author

Developed by **Kartikey** as a B.Tech (CSE) final-year project.
