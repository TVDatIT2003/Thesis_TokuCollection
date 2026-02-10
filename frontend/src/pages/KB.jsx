import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { backendUrl } from '../App';
import { toast } from 'react-toastify';

export default function KB({ token }) {
  const [title, setTitle] = useState('');
  const [tags, setTags] = useState('');
  const [text, setText] = useState('');
  const [items, setItems] = useState([]);

  const load = async () => {
    const { data } = await axios.get(`${backendUrl}/api/ai/kb/list`, { headers: { token } });
    if (data.success) setItems(data.items); else toast.error(data.message);
  };

  const upsert = async (e) => {
    e.preventDefault();
    const body = { title, text, tags: tags.split(',').map(s => s.trim()).filter(Boolean) };
    const { data } = await axios.post(`${backendUrl}/api/ai/kb/upsert`, body, { headers: { token } });
    if (data.success) {
      toast.success('Saved'); setTitle(''); setTags(''); setText(''); load();
    } else toast.error(data.message);
  };

  const remove = async (id) => {
    const { data } = await axios.delete(`${backendUrl}/api/ai/kb/${id}`, { headers: { token } });
    data.success ? (toast.success('Removed'), load()) : toast.error(data.message);
  };

  useEffect(() => { if (token) load(); }, [token]);

  return (
    <div>
      <h3 className='mb-3'>Knowledge Base</h3>
      <form onSubmit={upsert} className='flex flex-col gap-2 max-w-xl'>
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder='Title' className='border p-2' required />
        <input value={tags} onChange={e=>setTags(e.target.value)} placeholder='tags, comma,separated' className='border p-2' />
        <textarea value={text} onChange={e=>setText(e.target.value)} rows={6} placeholder='Content' className='border p-2' required />
        <button className='bg-black text-white px-4 py-2 w-28'>Save</button>
      </form>

      <div className='mt-6 space-y-2'>
        {items.map(it => (
          <div key={it.id} className='border p-3'>
            <div className='font-medium'>{it.title}</div>
            <div className='text-xs text-gray-500'>{(it.tags||[]).join(', ')}</div>
            <p className='text-sm mt-1 line-clamp-3'>{it.text}</p>
            <button onClick={()=>remove(it.id)} className='text-red-600 mt-2'>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
