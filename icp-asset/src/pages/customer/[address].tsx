import React from 'react';
import { useRouter } from 'next/router';
import Customer from '../../components/Customer';
import { Box, Center, Spinner } from '@chakra-ui/react';

const CustomerPage = () => {
    const router = useRouter();
    const { address } = router.query;

    if (!address) {
        return (
            <Center h="60vh">
                <Spinner size="xl" />
            </Center>
        );
    }

    return (
        <Box pt={4} pb={10}>
            <Customer contractAddress={address as string} />
        </Box>
    );
};

export default CustomerPage; 