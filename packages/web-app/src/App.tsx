import React, { useState } from 'react';
import axios from 'axios';

// Define the type for the prediction data
type Prediction = {
  [key: string]: string | null | { [key: string]: number }
};

const API_URL = 'http://localhost:3001/api/upload';

export default function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setPreview(URL.createObjectURL(file));
      setPrediction(null);
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    setError(null);
    setPrediction(null);

    const formData = new FormData();
    formData.append('image', selectedFile);

    try {
      const response = await axios.post(API_URL, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPrediction(response.data);
    } catch (err) {
      setError('Failed to get prediction. The model might be warming up. Try again in a moment.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const renderSpecs = () => {
    if (!prediction) return null;
    const { confidence_scores, ...specs } = prediction;
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
        {Object.entries(specs).map(([key, value]) =>
          value ? (
            <div key={key} className="bg-white p-4 rounded-lg shadow">
              <p className="text-sm font-medium text-gray-500 capitalize">{key.replace('_', ' ')}</p>
              <p className="text-xl font-semibold text-gray-800">{String(value)}</p>
            </div>
          ) : null
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-4 sm:p-8">
      <div className="w-full max-w-4xl">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-flipkart-blue">ML-Powered Catalog Assistant</h1>
          <p className="text-gray-600 mt-2">Upload a product image to automatically extract specifications.</p>
        </header>

        <main className="bg-white p-6 rounded-xl shadow-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Side - Uploader */}
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-6">
              <input type="file" id="file-upload" className="hidden" onChange={handleFileChange} accept="image/*" />
              <label htmlFor="file-upload" className="cursor-pointer bg-flipkart-blue text-white font-semibold py-2 px-6 rounded-md hover:bg-blue-700 transition-colors">
                Choose Image
              </label>
              {preview && <img src={preview} alt="Preview" className="mt-4 max-h-48 rounded-lg object-contain" />}
              <button
                onClick={handleSubmit}
                disabled={!selectedFile || isLoading}
                className="mt-4 w-full bg-flipkart-yellow text-gray-800 font-bold py-3 px-4 rounded-md disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-yellow-400 transition-colors"
              >
                {isLoading ? 'Analyzing...' : 'Extract Specs'}
              </button>
            </div>

            {/* Right Side - Results */}
            <div className="flex flex-col justify-center">
              <h2 className="text-2xl font-semibold text-gray-800">Extracted Specifications</h2>
              {isLoading && <p className="text-gray-500 mt-4">Processing image with AI, please wait...</p>}
              {error && <p className="text-red-500 mt-4">{error}</p>}
              {prediction ? renderSpecs() : <p className="text-gray-500 mt-4">Results will appear here.</p>}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
