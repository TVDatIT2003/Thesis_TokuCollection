import React from 'react'
import { assets } from '../assets/assets'

const Footer = () => {
  return (
    <div>
      <div className='flex flex-col sm:grid grid-cols-[3fr_1fr_1fr] gap-14 my-10 mt-40 text-sm'>

        <div>
            <img src={assets.logo} className='mb-5 w-32' alt="" />
            <p className='w-full md:w-2/3 text-gray-600'>
            This website is created by a IT student who have an intersting hobby about Tokusatsu franchise, and he wants to realize the dream of making a Tokusatsu website.
            </p>
        </div>

        <div>
            <p className='text-xl font-medium mb-5'>COMPANY</p>
            <ul className='flex flex-col gap-1 text-gray-600'>
                <a href="/">Home</a>
                <a href="about">About us </a>
                <li>Delivery</li>
                <li>Privacy policy</li>
                <a href=""></a>
            </ul>
        </div>

        <div>
            <p className='text-xl font-medium mb-5'>GET IN TOUCH</p>
            <ul className='flex flex-col gap-1 text-gray-600'>
                <li>+84-123-456-7890</li>
                <li>contact@gmail.com</li>
            </ul>
        </div>

      </div>

        <div>
            <hr />
            <p className='py-5 text-sm text-center'>Copyright 2025@ Tokucollection.com - All Right Reserved.</p>
        </div>

    </div>
  )
}

export default Footer
