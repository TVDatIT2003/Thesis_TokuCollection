import p_img1 from './p_img1.png'
import p_img2 from './p_img2.png'
import p_img3 from './p_img3.png'
import p_img3_1 from './p_img3_1.png'
import p_img3_2 from './p_img3_2.png'
import p_img3_3 from './p_img3_3.png'

import logo from './logo.png'
import hero_img from './hero_img.png'
import cart_icon from './cart_icon.png'
import bin_icon from './bin_icon.png'
import dropdown_icon from './dropdown_icon.png'
import exchange_icon from './exchange_icon.png'
import profile_icon from './profile_icon.png'
import quality_icon from './quality_icon.png'
import search_icon from './search_icon.png'
import star_dull_icon from './star_dull_icon.png'
import star_icon from './star_icon.png'
import support_img from './support_img.png'
import menu_icon from './menu_icon.png'
import about_img from './about_img.png'
import contact_img from './contact_img.png'
import razorpay_logo from './razorpay_logo.png'
import stripe_logo from './stripe_logo.png'
import paypal_logo from './paypal_logo.png'
import cross_icon from './cross_icon.png'

export const assets = {
    logo,
    hero_img,
    cart_icon,
    dropdown_icon,
    exchange_icon,
    profile_icon,
    quality_icon,
    search_icon,
    star_dull_icon,
    star_icon,
    bin_icon,
    support_img,
    menu_icon,
    about_img,
    contact_img,
    razorpay_logo,
    stripe_logo,
    cross_icon,
    paypal_logo
}

export const products = [
    {
        _id: "aaaaa",
        name: "DX Gochizo Set 01",
        description: "DX Gochizo Set 01 from serie Kamen Rider Gavv",
        price: 280000,
        image: [p_img1],
        category: "Kamenrider",
        subCategory: "Instock",
        date: 1716634345448,
        bestseller: true
    },
    {
        _id: "aaaab",
        name: "DX Gochizo Set 02",
        description: "DX Gochizo Set 02 from serie Kamen Rider Gavv",
        price: 280000,
        image: [p_img2],
        category: "Kamenrider",
        subCategory: "Instock",
        date: 1716621345448,
        bestseller: true
    },

    {
        _id: "aaaac",
        name: "(Pre Order) CSM Lost Driver 2.0",
        description: "CSM Lost Driver 2.0 from Kamen Rider W",
        price: 6650000,
        image: [p_img3, p_img3_1, p_img3_2, p_img3_3],
        category: "Kamenrider",
        subCategory: "Preorder",
        date: 1716621345448,
        bestseller: true
    },

]