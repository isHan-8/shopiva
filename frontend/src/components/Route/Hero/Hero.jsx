import React from "react";
import { Link } from "react-router-dom";
import styles from "../../../styles/styles";

const Hero = () => {
  return (
    <div
      className={`relative min-h-[70vh] 800px:min-h-[80vh] w-full bg-no-repeat ${styles.noramlFlex}`}
      style={{
        backgroundImage:
          "url(https://plus.unsplash.com/premium_photo-1683288295814-84a199da83d9?q=80&w=1974&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D)",
      }}
    >
      <div className={`${styles.section} w-[90%] 800px:w-[60%]`}>
        <h1
          className={`text-[35px] leading-[1.2] 800px:text-[60px] text-[#48c6a6] font-extrabold capitalize  italic`}
        >
         Create Your Dream Space
        </h1>

        <p className="pt-5 text-[16px] font-[Poppins] font-[400] text-[#43cc2bba]">
          Welcome to Shopiva, your one-stop destination for the best in home
          decor. Discover unique and stylish pieces that add charm and elegance
          to any space. Quality and customer satisfaction are our top
          priorities.
        </p>
        <Link to="/products" className="inline-block">
          <div className={`${styles.button} mt-5`}>
            <span className="text-[#e28f8f] font-[Poppins] text-[18px]">
              Shop Now
            </span>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default Hero;
