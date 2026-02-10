import axios from 'axios'
import React, { useEffect, useState } from 'react'
import { backendUrl, currency } from '../App'
import { toast } from 'react-toastify'

const List = ({ token }) => {

  const [list, setList] = useState([])

  const [stocks, setStocks] = useState({});

  const handleStockChange = (id, value) => {
    setStocks({ ...stocks, [id]: value });
  };

  const saveStock = async (productId) => {
    try {
      await axios.put(
        backendUrl + '/api/product/stock',
        { productId, stock: stocks[productId] },
        { headers: { token } }
      );
      toast.success("Update stock successfully");
      await fetchList(); // reload list after updated
    } catch (error) {
      console.log(error);
      toast.error(error.message);
    }
  };

  const fetchList = async () => {
    try {

      const response = await axios.get(backendUrl + '/api/product/list')
      if (response.data.success) {
        setList(response.data.products.reverse());
      }
      else {
        toast.error(response.data.message)
      }

    } catch (error) {
      console.log(error)
      toast.error(error.message)
    }
  }

  const removeProduct = async (id) => {
    try {

      const response = await axios.post(backendUrl + '/api/product/remove', { id }, { headers: { token } })

      if (response.data.success) {
        toast.success(response.data.message)
        await fetchList();
      } else {
        toast.error(response.data.message)
      }

    } catch (error) {
      console.log(error)
      toast.error(error.message)
    }
  }



  useEffect(() => {
    fetchList()
  }, [])

  return (
    <>
      <p className='mb-2'>All Products List</p>
      <div className='flex flex-col gap-2'>

        {/* ------- List Table Title ---------- */}

        <div className='hidden md:grid grid-cols-[1fr_3fr_3fr_1fr_1fr_1fr] items-center py-1 px-2 border bg-gray-100 text-sm'>
          <b>Image</b>
          <b>Name</b>
          <b>Stock</b>
          <b>Order State</b>
          <b>Price</b>
          <b className='text-center'>Action</b>
        </div>

        {/* ------ Product List ------ */}

        {
          list.map((item, index) => (
            <div className='grid grid-cols-[1fr_3fr_1fr] md:grid-cols-[1fr_3fr_3fr_1fr_1fr_1fr] items-center gap-2 py-1 px-2 border text-sm' key={index}>
              <img className='w-12' src={item.image[0]} alt="" />
              <p>{item.name}</p>
              
              <div>
                <input type="number" min="0" value={stocks[item._id] ?? item.stock} onChange={(e) => handleStockChange(item._id, e.target.value)} className="w-16 border px-1" />
                <button onClick={() => saveStock(item._id)} className="ml-2 text-sm bg-blue-500 text-white px-2 py-1 rounded">Save</button>
              </div>
                
              <p>{item.subCategory}</p>
              <p>{item.price} {currency}</p>
              <p onClick={()=>removeProduct(item._id)} className='text-right md:text-center cursor-pointer text-lg'>X</p>
            </div>
          ))
        }

      </div>
    </>
  )
}

export default List