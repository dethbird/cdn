import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import FileUpload from '../components/FileUpload';

export default function Upload() {
  const navigate = useNavigate();
  const [collections, setCollections] = useState([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState(null);

  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    try {
      const response = await fetch('/api/collections');
      if (response.ok) {
        const data = await response.json();
        setCollections(data);
        
        if (!selectedCollectionId && data.length > 0) {
          setSelectedCollectionId(data[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch collections:', error);
    }
  };

  const handleUploadSuccess = (response) => {
    console.log('Upload successful:', response);
    // Navigate back to home after successful upload
    navigate('/');
  };

  return (
    <section className="section main-app has-background-light">
      <div className="container">
        <div className="level mb-5">
          <div className="level-left">
            <div className="level-item">
              <h2 className="title is-4 mb-0">Upload File</h2>
            </div>
          </div>
          <div className="level-right">
            <div className="level-item">
              <button
                onClick={() => navigate('/')}
                className="button is-light"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>

        <FileUpload 
          collections={collections}
          selectedCollectionId={selectedCollectionId}
          onCollectionChange={setSelectedCollectionId}
          onUploadSuccess={handleUploadSuccess} 
        />
      </div>
    </section>
  );
}
