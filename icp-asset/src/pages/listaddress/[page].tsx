import { useRouter } from 'next/router';
import ListAddressOwner from '../../components/ListAddressOwner';
import { useEffect, useState } from 'react';
import { AuthClient } from '@dfinity/auth-client';
import { Box, Center, Spinner, Text } from '@chakra-ui/react';

const ListAddressPage = () => {
    const router = useRouter();
    const { page } = router.query;
    const [isLoading, setIsLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [principal, setPrincipal] = useState("");

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const authClient = await AuthClient.create();
                const authenticated = await authClient.isAuthenticated();
                setIsAuthenticated(authenticated);

                if (authenticated) {
                    const identity = authClient.getIdentity();
                    setPrincipal(identity.getPrincipal().toText());
                }

                setIsLoading(false);
            } catch (error) {
                console.error("Authentication check failed:", error);
                setIsLoading(false);
            }
        };

        checkAuth();
    }, []);

    useEffect(() => {
        // If not authenticated and finished loading, redirect to home
        if (!isLoading && !isAuthenticated) {
            router.push('/');
        }
    }, [isLoading, isAuthenticated, router]);

    if (isLoading) {
        return (
            <Center h="60vh">
                <Spinner size="xl" />
            </Center>
        );
    }

    if (!isAuthenticated) {
        return (
            <Center h="60vh">
                <Text>Please log in to view markets</Text>
            </Center>
        );
    }

    if (!page) {
        return (
            <Center h="60vh">
                <Spinner size="md" />
            </Center>
        );
    }

    const pageNumber = parseInt(page as string, 10);
    const finalPage = isNaN(pageNumber) ? 1 : pageNumber;

    return (
        <Box pt={4} pb={10}>
            <ListAddressOwner ownerAddress={principal} page={finalPage} />
        </Box>
    );
};

export default ListAddressPage; 