import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewCollectionForm, setShowNewCollectionForm] = useState(false);
  const [newCollectionTitle, setNewCollectionTitle] = useState('');

  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    try {
      const response = await fetch('/api/collections');
      if (response.ok) {
        const data = await response.json();
        // Fetch each collection's media for preview
        const collectionsWithMedia = await Promise.all(
          data.map(async (collection) => {
            try {
              const mediaResponse = await fetch(`/api/collections/${collection.id}`);
              if (mediaResponse.ok) {
                const mediaData = await mediaResponse.json();
                return { ...collection, media: mediaData.media || [] };
              }
            } catch (error) {
              console.error(`Failed to fetch media for collection ${collection.id}:`, error);
            }
            return { ...collection, media: [] };
          })
        );
        setCollections(collectionsWithMedia);
      }
    } catch (error) {
      console.error('Failed to fetch collections:', error);
    } finally {
      setLoading(false);
    }
  };

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
        setNewCollectionTitle('');
        setShowNewCollectionForm(false);
        await fetchCollections();
      }
    } catch (error) {
      console.error('Failed to create collection:', error);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="has-text-centered has-text-grey mt-6">
          Loading collections...
        </div>
      </div>
    );
  }

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

      {/* Collections Grid */}
      {collections.length > 0 ? (
        <div className="columns is-multiline">
          {collections.map((collection) => {
            const recentMedia = collection.media.slice(0, 4);
            const hasMedia = recentMedia.length > 0;
            
            return (
              <div key={collection.id} className="column is-one-third-desktop is-half-tablet">
                <div 
                  className="card is-clickable"
                  onClick={() => {
                    localStorage.setItem('lastSelectedCollectionId', collection.id);
                    navigate(`/collection/${collection.id}`);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="card-image">
                    {hasMedia ? (
                      <div className={`collection-preview ${recentMedia.some(m => m.type !== 'image') ? 'has-non-images' : ''}`}>
                        {recentMedia.map((media, idx) => {
                          const variant640 = media.variants?.find(v => v.variant === '640');
                          const variant960 = media.variants?.find(v => v.variant === '960');
                          const displayVariant = variant640 || variant960 || media.variants?.[0];
                          
                          if (!displayVariant) return null;
                          
                          const isImage = media.type === 'image';
                          const isArchive = media.type === 'archive';
                          const isAudio = media.type === 'audio';
                          const isVideo = media.type === 'video';
                          
                          // Check if collection has mixed content
                          const hasNonImages = recentMedia.some(m => m.type !== 'image');
                          
                          // For stacked pile effect (images only)
                          const rotations = [-8, -4, 3, 7];
                          const rotation = rotations[idx % rotations.length];
                          const zIndex = idx + 1;
                          
                          return (
                            <div 
                              key={media.id} 
                              className={`preview-item ${isImage && !hasNonImages ? 'is-image' : ''}`}
                              style={isImage && !hasNonImages ? {
                                transform: `rotate(${rotation}deg)`,
                                zIndex: zIndex
                              } : undefined}
                            >
                              {isImage ? (
                                <figure className="image is-square">
                                  <img src={displayVariant.url} alt={media.title || ''} />
                                </figure>
                              ) : (
                                <div className="preview-placeholder has-background-white has-text-grey">
                                  {isArchive ? (
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                      <polyline points="7 10 12 15 17 10"></polyline>
                                      <line x1="12" y1="15" x2="12" y2="3"></line>
                                    </svg>
                                  ) : isAudio ? (
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M9 18V5l12-2v13"></path>
                                      <circle cx="6" cy="18" r="3"></circle>
                                      <circle cx="18" cy="16" r="3"></circle>
                                    </svg>
                                  ) : isVideo ? (
                                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <polygon points="23 7 16 12 23 17 23 7"></polygon>
                                      <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                                    </svg>
                                  ) : null}
                                  <div className="mt-2 px-2" style={{ wordBreak: 'break-word', lineHeight: '1.2' }}>
                                    {media.title && <p className="is-size-7 has-text-weight-semibold mb-1">{media.title}</p>}
                                    <p className="is-size-7 has-text-grey-light">{media.originalFilename || 'File'}</p>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="empty-collection has-background-light has-text-grey">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                        </svg>
                        <p className="mt-3">Empty Collection</p>
                      </div>
                    )}
                  </div>
                  <div className="card-content">
                    <p className="title is-5 mb-2">{collection.title}</p>
                    {collection.description && (
                      <p className="has-text-grey is-size-7 mb-2" style={{ fontStyle: 'italic' }}>
                        {collection.description}
                      </p>
                    )}
                    <p className="subtitle is-7 has-text-grey mb-3">
                      {collection.media.length} {collection.media.length === 1 ? 'item' : 'items'}
                    </p>
                    <div className="buttons">
                      <button
                        className="button is-small is-info"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/collection/${collection.id}/edit`);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="button is-small is-danger"
                        disabled={collection.media.length > 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          // TODO: wire up delete functionality
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="has-text-centered has-text-grey mt-6">
          <p className="mb-4">No collections yet.</p>
          <button
            onClick={() => setShowNewCollectionForm(true)}
            className="button is-link"
          >
            Create your first collection
          </button>
        </div>
      )}
    </div>
  );
}
