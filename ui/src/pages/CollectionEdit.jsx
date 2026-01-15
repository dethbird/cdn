import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function CollectionEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [collection, setCollection] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCollection();
  }, [id]);

  const fetchCollection = async () => {
    try {
      const response = await fetch(`/api/collections/${id}`);
      if (response.ok) {
        const data = await response.json();
        setCollection(data);
        setTitle(data.title || '');
        setDescription(data.description || '');
      } else {
        navigate('/');
      }
    } catch (error) {
      console.error('Failed to fetch collection:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    
    if (!title.trim()) {
      alert('Collection title is required');
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`/api/collections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || null
        })
      });

      if (response.ok) {
        navigate('/');
      } else {
        alert('Failed to update collection');
      }
    } catch (error) {
      console.error('Failed to update collection:', error);
      alert('Failed to update collection');
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

  if (!collection) {
    return null;
  }

  return (
    <div className="container">
      <div className="level mb-5">
        <div className="level-left">
          <div className="level-item">
            <button
              onClick={() => navigate('/')}
              className="button is-light mr-4"
            >
              ← Back
            </button>
          </div>
          <div className="level-item">
            <h2 className="title is-4 mb-0">Edit Collection</h2>
          </div>
        </div>
      </div>

      <div className="columns">
        <div className="column is-half is-offset-one-quarter">
          <div className="box">
            <form onSubmit={handleSave}>
              <div className="field">
                <label className="label">Collection Name</label>
                <div className="control">
                  <input
                    className="input"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter collection name"
                    required
                  />
                </div>
              </div>

              <div className="field">
                <label className="label">Description</label>
                <div className="control">
                  <textarea
                    className="textarea"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Add a description (optional)"
                    rows={5}
                  />
                </div>
              </div>

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
                    onClick={() => navigate('/')}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
