import { useEffect } from 'react';
import { useRouter } from 'next/router';
import type { NextPage } from "next";
import Head from "next/head";
import Customer from "../components/Customer";
import Navbar from "../components/Navbar";

const Home: NextPage = () => {
  const router = useRouter();
  const { marketId } = router.query;

  useEffect(() => {
    // If marketId is present in the URL, route to the customer page for that market
    if (marketId) {
      router.replace(`/customer/${marketId}`);
    } else {
      // Otherwise, go to the markets listing page
      router.replace('/markets/1');
    }
  }, [router, marketId]);

  return null;
};

export default Home;
