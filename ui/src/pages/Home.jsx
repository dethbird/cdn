import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();
  const [collection, setCollection] = useState(null);
  const [collections, setCollections] = useState([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNewCollectionForm, setShowNewCollectionForm] = useState(false);
  const [newCollectionTitle, setNewCollectionTitle] = useState('');

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

  const fetchCollection = async (collectionId) => {
    if (!collectionId) {
      setLoading(false);
      return;
    }
    
    try {
      const response = await fetch(`/api/collections/${collectionId}`);
      if (response.ok) {
        const data = await response.json();
        setCollection(data);
      }
    } catch (error) {
      console.error('Failed to fetch collection:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCollections();
  }, []);

  useEffect(() => {
    if (selectedCollectionId) {
      fetchCollection(selectedCollectionId);
    }
  }, [selectedCollectionId]);

  const handleCreateCollection = async (e) => {
    e.preventDefault();
    
    if (!newCollectionTitle.trim()) return;
    
    try {
      const response = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newCollectionTitle
        })
      });
      
      if (response.ok) {
        const newCollection = await response.json();
        setNewCollectionTitle('');
        setShowNewCollectionForm(false);
        await fetchCollections();
        setSelectedCollectionId(newCollection.id);
      }
    } catch (error) {
      console.error('Failed to create collection:', error);
    }
  };

  return (
    <div className="container">
      {/* Action Buttons */}
      <div className="level mb-5">
        <div className="level-left">
          <div className="level-item">
            <h2 className="title is-4 mb-0">My Collections</h2>
          </div>
        </div>
        <div className="level-right">
          <div className="level-item">
            <div className="buttons">
              <button
                onClick={() => navigate('/upload')}
                className="button is-primary"
              >
                Upload
              </button>
              <button
                onClick={() => setShowNewCollectionForm(!showNewCollectionForm)}
                className="button is-link"
              >
                {showNewCollectionForm ? 'Cancel' : '+ New Collection'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* New Collection Form */}
      {showNewCollectionForm && (
        <div className="box mb-5">
          <form onSubmit={handleCreateCollection}>
            <div className="field">
              <label className="label">Collection Name</label>
              <div className="control">
                <input
                  className="input form-field-max"
                  type="text"
                  value={newCollectionTitle}
                  onChange={(e) => setNewCollectionTitle(e.target.value)}
                  placeholder="My New Collection"
                  required
                />
              </div>
            </div>
            <div className="field">
              <div className="control">
                <button type="submit" className="button is-success">
                  Create Collection
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Collection Selector */}
      {collections && collections.length > 0 && (
        <div className="field mb-5">
          <label className="label">View Collection</label>
          <div className="control">
            <div className="select">
              <select
                value={selectedCollectionId || ''}
                onChange={(e) => setSelectedCollectionId(parseInt(e.target.value))}
              >
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
      
      {/* Media Gallery */}
      {loading ? (
        <div className="has-text-centered has-text-grey mt-6">
          Loading your images...
        </div>
      ) : collection && collection.media && collection.media.length > 0 ? (
        <div className="mt-6">
          <h3 className="title is-5 mb-5">
            {collection.title || 'My Uploads'}
          </h3>
          <div className="columns is-multiline">
            {collection.media.map((media) => {
              const variant640 = media.variants.find(v => v.variant === '640');
              const variant960 = media.variants.find(v => v.variant === '960');
              const displayVariant = variant640 || variant960 || media.variants[0];
              const isArchive = media.type === 'archive';
              const isAudio = media.type === 'audio';
              const isVideo = media.type === 'video';
              
              return (
                <div key={media.id} className="column is-one-third-desktop is-half-tablet">
                  <div className="card">
                    {isArchive ? (
                      <div className="card-image">
                        <div className="media-placeholder has-background-light has-text-grey">
                          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                          </svg>
                          <p className="mt-3 is-size-7 has-text-weight-medium">ZIP Archive</p>
                        </div>
                      </div>
                    ) : isAudio ? (
                      <div className="card-image">
                        <div className="audio-container has-background-light">
                          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 18V5l12-2v13"></path>
                            <circle cx="6" cy="18" r="3"></circle>
                            <circle cx="18" cy="16" r="3"></circle>
                          </svg>
                          <audio controls className="audio-player">
                            <source src={displayVariant.url} type="audio/mpeg" />
                          </audio>
                        </div>
                      </div>
                    ) : isVideo ? (
                      <div className="card-image">
                        <video controls className="video-player">
                          <source src={displayVariant.url} type="video/mp4" />
                        </video>
                      </div>
                    ) : (
                      <div className="card-image">
                        <figure className="image">
                          <img src={displayVariant.url} alt={media.title || 'Uploaded image'} />
                        </figure>
                      </div>
                    )}
                    <div className="card-content">
                      {media.title && (
                        <p className="title is-6 mb-2">{media.title}</p>
                      )}
                      {media.caption && (
                        <p className="subtitle is-7 has-text-grey mb-2">{media.caption}</p>
                      )}
                      {!isArchive && !isAudio && !isVideo && media.width && media.height && (
                        <p className="is-size-7 has-text-grey-light mb-2">
                          {media.width} × {media.height}
                        </p>
                      )}
                      <div className="tags">
                        {media.variants.map(v => (
                          <a key={v.id} href={v.url} download className="tag is-light">
                            {v.variant} ({Math.round(v.bytes / 1024)}KB)
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="has-text-centered has-text-grey mt-6">
          No media yet. Click Upload to add your first file!
        </div>
      )}
    </div>
  );
}
