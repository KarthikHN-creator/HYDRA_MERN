const mongoose = require('mongoose')

const connectionStates = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
}

function getDatabaseStatus() {
  const readyState = mongoose.connection.readyState
  return {
    status: connectionStates[readyState] || 'unknown',
    connected: readyState === 1,
  }
}

async function connectDB(uri = process.env.MONGODB_URI) {
  if (!uri) {
    console.warn('MONGODB_URI is not set; database remains disconnected')
    return false
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 })
    console.log('MongoDB connected')
    return true
  } catch (error) {
    console.error(`MongoDB connection failed: ${error.message}`)
    return false
  }
}

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected')
})

mongoose.connection.on('error', (error) => {
  console.error(`MongoDB connection error: ${error.message}`)
})

module.exports = { connectDB, getDatabaseStatus }
