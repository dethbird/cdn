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
        
        // Try to use the last selected collection from localStorage
        const lastSelectedId = localStorage.getItem('lastSelectedCollectionId');
        if (lastSelectedId) {
          const collectionExists = data.find(c => c.id === parseInt(lastSelectedId));
          if (collectionExists) {
            setSelectedCollectionId(parseInt(lastSelectedId));
            return;
          }
        }
        
        // Fallback to first collection if no last selection or it doesn't exist
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
    // Navigate to the collection that was uploaded to
    if (selectedCollectionId) {
      navigate(`/collection/${selectedCollectionId}`);
    } else {
      navigate('/');
    }
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
                <span className="icon">
                  <i className="fas fa-times"></i>
                </span>
                <span>Cancel</span>
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
