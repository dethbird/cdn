import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function MediaEdit() {
  const { id, mediaId } = useParams();
  const navigate = useNavigate();
  const [media, setMedia] = useState(null);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchMedia();
  }, [id, mediaId]);

  const fetchMedia = async () => {
    try {
      // Fetch the collection to get the media item
      const response = await fetch(`/api/collections/${id}`);
      if (response.ok) {
        const collection = await response.json();
        const mediaItem = collection.media?.find(m => m.id === parseInt(mediaId));
        
        if (mediaItem) {
          setMedia(mediaItem);
          setTitle(mediaItem.title || '');
          setCaption(mediaItem.caption || '');
        } else {
          navigate(`/collection/${id}`);
        }
      } else {
        navigate('/');
      }
    } catch (error) {
      console.error('Failed to fetch media:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(`/api/media/${mediaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || null,
          caption: caption.trim() || null
        })
      });

      if (response.ok) {
        navigate(`/collection/${id}`);
      } else {
        alert('Failed to update media');
      }
    } catch (error) {
      console.error('Failed to update media:', error);
      alert('Failed to update media');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="has-text-centered has-text-grey mt-6">
          Loading...
        </div>
      </div>
    );
  }

  if (!media) {
    return null;
  }

  const variant640 = media.variants?.find(v => v.variant === '640');
  const variant960 = media.variants?.find(v => v.variant === '960');
  const displayVariant = variant640 || variant960 || media.variants?.[0];
  const isImage = media.type === 'image';
  const isArchive = media.type === 'archive';
  const isAudio = media.type === 'audio';
  const isVideo = media.type === 'video';

  return (
    <div className="container">
      <div className="level mb-5">
        <div className="level-left">
          <div className="level-item">
            <button
              onClick={() => navigate(`/collection/${id}`)}
              className="button is-light mr-4"
            >
              ← Back
            </button>
          </div>
          <div className="level-item">
            <h2 className="title is-4 mb-0">Edit Media</h2>
          </div>
        </div>
      </div>

      <div className="columns">
        <div className="column is-half">
          <div className="box">
            {isImage && displayVariant ? (
              <figure className="image">
                <img src={displayVariant.url} alt={media.title || 'Media preview'} />
              </figure>
            ) : isArchive ? (
              <div className="has-text-centered py-6">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                <p className="mt-3">ZIP Archive</p>
              </div>
            ) : isAudio ? (
              <div className="has-text-centered py-6">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18V5l12-2v13"></path>
                  <circle cx="6" cy="18" r="3"></circle>
                  <circle cx="18" cy="16" r="3"></circle>
                </svg>
                {displayVariant && (
                  <audio controls className="mt-4" style={{ width: '100%' }}>
                    <source src={displayVariant.url} type="audio/mpeg" />
                  </audio>
                )}
              </div>
            ) : isVideo && displayVariant ? (
              <video controls style={{ width: '100%' }}>
                <source src={displayVariant.url} type="video/mp4" />
              </video>
            ) : null}
          </div>
        </div>

        <div className="column is-half">
          <form onSubmit={handleSave}>
            <div className="field">
              <label className="label">Title</label>
              <div className="control">
                <input
                  className="input"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter a title"
                />
              </div>
            </div>

            <div className="field">
              <label className="label">Description</label>
              <div className="control">
                <textarea
                  className="textarea"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Add a description"
                  rows={5}
                />
              </div>
            </div>

            {media.originalFilename && (
              <div className="field">
                <label className="label">Original Filename</label>
                <p className="is-size-7 has-text-grey">{media.originalFilename}</p>
              </div>
            )}

            {media.width && media.height && (
              <div className="field">
                <label className="label">Dimensions</label>
                <p className="is-size-7 has-text-grey">{media.width} × {media.height}</p>
              </div>
            )}

            <div className="field is-grouped mt-5">
              <div className="control">
                <button
                  type="submit"
                  className={`button is-primary ${saving ? 'is-loading' : ''}`}
                  disabled={saving}
                >
                  Save Changes
                </button>
              </div>
              <div className="control">
                <button
                  type="button"
                  className="button is-light"
                  onClick={() => navigate(`/collection/${id}`)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
