import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function CollectionView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [collection, setCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedUrl, setCopiedUrl] = useState(null);

  useEffect(() => {
    if (id) {
      localStorage.setItem('lastSelectedCollectionId', id);
    }
    fetchCollection();
  }, [id]);

  const fetchCollection = async () => {
    try {
      const response = await fetch(`/api/collections/${id}`);
      if (response.ok) {
        const data = await response.json();
        setCollection(data);
      } else {
        // Collection not found, redirect to home
        navigate('/');
      }
    } catch (error) {
      console.error('Failed to fetch collection:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (mediaId, mediaTitle) => {
    if (!confirm(`Are you sure you want to delete "${mediaTitle || 'this item'}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/media/${mediaId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Refresh the collection
        fetchCollection();
      } else {
        alert('Failed to delete media');
      }
    } catch (error) {
      console.error('Failed to delete media:', error);
      alert('Failed to delete media');
    }
  };

  const handleCopyUrl = async (url, variantId) => {
    try {
      await navigator.clipboard.writeText(window.location.origin + url);
      setCopiedUrl(variantId);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (error) {
      console.error('Failed to copy URL:', error);
      alert('Failed to copy URL to clipboard');
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="has-text-centered has-text-grey mt-6">
          Loading collection...
        </div>
      </div>
    );
  }

  if (!collection) {
    return null;
  }

  return (
    <div className="container">
      {/* Header */}
      <div className="level mb-5">
        <div className="level-left">
          <div className="level-item">
            <button
              onClick={() => navigate('/')}
              className="button is-light mr-4"
            >
              <span className="icon">
                <i className="fas fa-arrow-left"></i>
              </span>
              <span>Back</span>
            </button>
          </div>
          <div className="level-item">
            <div>
              <h2 className="title is-4 mb-0">{collection.title || 'Collection'}</h2>
              {collection.description && (
                <p className="subtitle is-6 has-text-grey mt-1 mb-0">{collection.description}</p>
              )}
            </div>
          </div>
        </div>
        <div className="level-right">
          <div className="level-item">
            <button
              onClick={() => navigate('/upload')}
              className="button is-primary"
            >
              <span className="icon">
                <i className="fas fa-upload"></i>
              </span>
              <span>Upload</span>
            </button>
          </div>
        </div>
      </div>

      {/* Media Gallery */}
      {collection.media && collection.media.length > 0 ? (
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
                    <div className="tags mb-3">
                      {media.variants.map(v => (
                        <span
                          key={v.id}
                          className={`tag is-clickable ${copiedUrl === v.id ? 'is-success' : 'is-light'}`}
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleCopyUrl(v.url, v.id)}
                          title="Click to copy URL"
                        >
                          {copiedUrl === v.id ? (
                            <>
                              <span className="icon is-small mr-1">
                                <i className="fas fa-check"></i>
                              </span>
                              Copied!
                            </>
                          ) : (
                            `${v.variant} (${Math.round(v.bytes / 1024)}KB)`
                          )}
                        </span>
                      ))}
                    </div>
                    <div className="buttons">
                      <button
                        className="button is-small is-info"
                        onClick={() => navigate(`/collection/${id}/media/${media.id}/edit`)}
                        title="Edit media"
                      >
                        <span className="icon is-small">
                          <i className="fas fa-edit"></i>
                        </span>
                      </button>
                      <button
                        className="button is-small is-danger"
                        onClick={() => handleDelete(media.id, media.title)}
                        title="Delete media"
                      >
                        <span className="icon is-small">
                          <i className="fas fa-trash"></i>
                        </span>
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
          No media in this collection yet. Click Upload to add files!
        </div>
      )}
    </div>
  );
}
