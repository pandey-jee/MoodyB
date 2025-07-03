interface SpotifyAccessToken {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: {
    images: Array<{ url: string; height: number; width: number }>;
  };
  preview_url: string | null;
  duration_ms: number;
}

interface SpotifyRecommendationsResponse {
  tracks: SpotifyTrack[];
}

interface SpotifyAudioFeatures {
  energy: number;
  valence: number;
  danceability: number;
  acousticness: number;
  instrumentalness: number;
  speechiness: number;
}

export class SpotifyService {
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpires: number = 0;

  constructor() {
    this.clientId = process.env.SPOTIFY_CLIENT_ID || process.env.SPOTIFY_CLIENT_ID_ENV_VAR || "default_client_id";
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET || process.env.SPOTIFY_CLIENT_SECRET_ENV_VAR || "default_client_secret";
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpires) {
      return this.accessToken;
    }

    try {
      const response = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Authorization": `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
        },
        body: "grant_type=client_credentials",
      });

      if (!response.ok) {
        throw new Error(`Spotify auth failed: ${response.statusText}`);
      }

      const data: SpotifyAccessToken = await response.json();
      this.accessToken = data.access_token;
      this.tokenExpires = Date.now() + (data.expires_in * 1000) - 60000; // Refresh 1 minute early

      return this.accessToken;
    } catch (error) {
      console.error("Spotify authentication failed:", error);
      throw new Error("Unable to authenticate with Spotify");
    }
  }

  private async spotifyRequest(endpoint: string): Promise<any> {
    const token = await this.getAccessToken();
    
    const url = `https://api.spotify.com/v1${endpoint}`;
    console.log(`Making Spotify request to: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
    });

    console.log(`Spotify response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Spotify API error: ${response.status} ${response.statusText}`, errorText);
      throw new Error(`Spotify API request failed: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`Spotify response data:`, JSON.stringify(data, null, 2));
    return data;
  }

  public async getRecommendations(
    energy: number, 
    valence: number, 
    genres: string[] = []
  ): Promise<SpotifyTrack[]> {
    try {
      // First try the official recommendations API
      const recommendationTracks = await this.tryOfficialRecommendations(energy, valence, genres);
      if (recommendationTracks.length > 0) {
        return recommendationTracks;
      }

      // Fallback to search-based recommendations
      console.log("Official recommendations API not available, using search fallback");
      return await this.getSearchBasedRecommendations(energy, valence, genres);
    } catch (error) {
      console.error("Failed to get any recommendations:", error);
      return [];
    }
  }

  private async tryOfficialRecommendations(
    energy: number, 
    valence: number, 
    genres: string[] = []
  ): Promise<SpotifyTrack[]> {
    try {
      // Map 1-10 scale to 0-1 scale for Spotify
      const spotifyEnergy = Math.max(0, Math.min(1, energy / 10));
      const spotifyValence = Math.max(0, Math.min(1, valence / 10));
      
      // Use only verified Spotify genre seeds
      const validSpotifyGenres = [
        "acoustic", "blues", "classical", "country", "dance", "electronic",
        "folk", "hip-hop", "indie", "jazz", "latin", "pop", "punk", "reggae",
        "rock", "soul", "world-music"
      ];
      
      let seedGenres: string[] = [];
      
      if (genres.length > 0) {
        seedGenres = genres
          .map(g => g.toLowerCase().replace(/[^a-z-]/g, ''))
          .filter(g => validSpotifyGenres.includes(g))
          .slice(0, 2);
      }
      
      if (seedGenres.length === 0) {
        if (spotifyValence >= 0.7 && spotifyEnergy >= 0.7) {
          seedGenres = ["pop", "dance"];
        } else if (spotifyValence <= 0.3) {
          seedGenres = ["blues", "folk"];
        } else if (spotifyEnergy <= 0.3) {
          seedGenres = ["acoustic", "classical"];
        } else {
          seedGenres = ["pop", "rock"];
        }
      }

      if (seedGenres.length === 0) {
        seedGenres = ["pop"];
      }

      const params = new URLSearchParams({
        seed_genres: seedGenres.join(","),
        target_energy: spotifyEnergy.toString(),
        target_valence: spotifyValence.toString(),
        limit: "10",
        market: "US"
      });

      console.log("Trying official recommendations API...");
      const data: SpotifyRecommendationsResponse = await this.spotifyRequest(`/recommendations?${params}`);
      return data.tracks || [];
    } catch (error) {
      console.log("Official recommendations API failed, will try search fallback");
      return [];
    }
  }

  private async getSearchBasedRecommendations(
    energy: number, 
    valence: number, 
    genres: string[] = []
  ): Promise<SpotifyTrack[]> {
    try {
      const searchTerms: string[] = [];
      
      // Generate search terms based on mood
      if (valence >= 7 && energy >= 7) {
        searchTerms.push("happy upbeat", "dance party", "energetic");
      } else if (valence >= 7) {
        searchTerms.push("happy", "feel good", "positive");
      } else if (valence <= 3 && energy <= 3) {
        searchTerms.push("sad slow", "melancholy", "emotional");
      } else if (valence <= 3) {
        searchTerms.push("sad", "blues", "heartbreak");
      } else if (energy >= 7) {
        searchTerms.push("energetic", "workout", "pump up");
      } else if (energy <= 3) {
        searchTerms.push("calm", "relaxing", "chill");
      } else {
        searchTerms.push("popular", "hits", "good vibes");
      }

      // Add genre-based searches
      if (genres.length > 0) {
        genres.forEach(genre => {
          if (genre) searchTerms.push(genre.toLowerCase());
        });
      }

      const allTracks: SpotifyTrack[] = [];
      const maxTracksPerSearch = Math.ceil(10 / searchTerms.length);

      // Search for tracks using different terms
      for (const term of searchTerms.slice(0, 3)) { // Limit to 3 searches
        try {
          const tracks = await this.searchTracks(term, maxTracksPerSearch);
          allTracks.push(...tracks);
          
          if (allTracks.length >= 10) break;
        } catch (error) {
          console.error(`Search failed for term "${term}":`, error);
        }
      }

      // Remove duplicates and return up to 10 tracks
      const uniqueTracks = allTracks.filter((track, index, arr) => 
        arr.findIndex(t => t.id === track.id) === index
      );

      return uniqueTracks.slice(0, 10);
    } catch (error) {
      console.error("Search-based recommendations failed:", error);
      return [];
    }
  }

  public async getAudioFeatures(trackIds: string[]): Promise<SpotifyAudioFeatures[]> {
    try {
      if (trackIds.length === 0) return [];
      
      const params = new URLSearchParams({
        ids: trackIds.join(","),
      });

      const data = await this.spotifyRequest(`/audio-features?${params}`);
      return data.audio_features || [];
    } catch (error) {
      console.error("Failed to get audio features:", error);
      return [];
    }
  }

  public async searchTracks(query: string, limit = 10): Promise<SpotifyTrack[]> {
    try {
      const params = new URLSearchParams({
        q: query,
        type: "track",
        limit: limit.toString(),
        market: "US",
      });

      const data = await this.spotifyRequest(`/search?${params}`);
      return data.tracks?.items || [];
    } catch (error) {
      console.error("Failed to search tracks:", error);
      return [];
    }
  }

  public async getAvailableGenres(): Promise<string[]> {
    try {
      const data = await this.spotifyRequest("/recommendations/available-genre-seeds");
      return data.genres || [];
    } catch (error) {
      console.error("Failed to get available genres, using fallback list:", error);
      // Return a comprehensive list of common music genres as fallback
      return [
        "acoustic", "afrobeat", "alt-rock", "alternative", "ambient", "blues", 
        "bossanova", "brazil", "breakbeat", "british", "chill", "classical", 
        "country", "dance", "electronic", "folk", "funk", "hip-hop", "house", 
        "indie", "jazz", "latin", "pop", "punk", "r-n-b", "reggae", "rock", 
        "soul", "world-music"
      ];
    }
  }
}

export const spotifyService = new SpotifyService();
