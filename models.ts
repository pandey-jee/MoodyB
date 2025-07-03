import mongoose from 'mongoose';

// Mood Entry Schema
const moodEntrySchema = new mongoose.Schema({
  text: {
    type: String,
    required: true
  },
  emoji: {
    type: String,
    required: true
  },
  quickMood: {
    type: String,
    required: true
  },
  energy: {
    type: Number,
    required: true,
    min: 1,
    max: 10
  },
  valence: {
    type: Number,
    required: true,
    min: 1,
    max: 10
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// AI Reflection Schema
const aiReflectionSchema = new mongoose.Schema({
  moodEntryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MoodEntry',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Spotify Recommendation Schema
const spotifyRecommendationSchema = new mongoose.Schema({
  moodEntryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MoodEntry',
    required: true
  },
  spotifyTrackId: {
    type: String,
    required: true
  },
  trackName: {
    type: String,
    required: true
  },
  artistName: {
    type: String,
    required: true
  },
  albumImageUrl: {
    type: String,
    default: null
  },
  previewUrl: {
    type: String,
    default: null
  },
  energy: {
    type: Number,
    required: true
  },
  valence: {
    type: Number,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Saved Playlist Schema
const savedPlaylistSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: null
  },
  moodEntryIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MoodEntry'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create and export models
export const MoodEntry = mongoose.model('MoodEntry', moodEntrySchema);
export const AiReflection = mongoose.model('AiReflection', aiReflectionSchema);
export const SpotifyRecommendation = mongoose.model('SpotifyRecommendation', spotifyRecommendationSchema);
export const SavedPlaylist = mongoose.model('SavedPlaylist', savedPlaylistSchema);

// TypeScript interfaces for better type safety
export interface IMoodEntry {
  _id?: mongoose.Types.ObjectId;
  text: string;
  energy: number;
  valence: number;
  createdAt?: Date;
}

export interface IAiReflection {
  _id?: mongoose.Types.ObjectId;
  moodEntryId: mongoose.Types.ObjectId;
  content: string;
  createdAt?: Date;
}

export interface ISpotifyRecommendation {
  _id?: mongoose.Types.ObjectId;
  moodEntryId: mongoose.Types.ObjectId;
  spotifyTrackId: string;
  trackName: string;
  artistName: string;
  albumImageUrl?: string | null;
  previewUrl?: string | null;
  energy: number;
  valence: number;
  createdAt?: Date;
}

export interface ISavedPlaylist {
  _id?: mongoose.Types.ObjectId;
  name: string;
  description?: string | null;
  moodEntryIds: mongoose.Types.ObjectId[];
  createdAt?: Date;
}
