import React, { useEffect, useState } from 'react';
import { Select, Flex, Text, useToast } from '@chakra-ui/react';
import { SUPPORTED_NETWORKS, switchNetwork, getCurrentNetwork, NetworkInfo } from '../utils/networkSwitcher';

export const NetworkSwitcher: React.FC = () => {
  const [currentNetwork, setCurrentNetwork] = useState<NetworkInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();

  useEffect(() => {
    loadCurrentNetwork();

    // Listen for network changes
    if (window.ethereum) {
      window.ethereum.on('chainChanged', () => {
        loadCurrentNetwork();
      });
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('chainChanged', loadCurrentNetwork);
      }
    };
  }, []);

  const loadCurrentNetwork = async () => {
    const network = await getCurrentNetwork();
    setCurrentNetwork(network);
  };

  const handleNetworkChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const chainIdHex = event.target.value;
    setIsLoading(true);

    const success = await switchNetwork(chainIdHex);

    if (success) {
      toast({
        title: 'Network switched',
        description: `Successfully switched to ${SUPPORTED_NETWORKS.find(n => n.chainIdHex === chainIdHex)?.name}`,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      await loadCurrentNetwork();
    } else {
      toast({
        title: 'Failed to switch network',
        description: 'Please try again or add the network manually in MetaMask',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }

    setIsLoading(false);
  };

  return (
    <Flex align="center" gap={2}>
      <Text fontSize="sm" color="gray.400">Network:</Text>
      <Select
        value={currentNetwork?.chainIdHex || ''}
        onChange={handleNetworkChange}
        size="sm"
        bg="black"
        color="white"
        borderColor="gray.600"
        isDisabled={isLoading}
        _hover={{ borderColor: 'gray.500' }}
        width="200px"
      >
        {SUPPORTED_NETWORKS.map((network) => (
          <option key={network.chainIdHex} value={network.chainIdHex} style={{ background: '#000' }}>
            {network.name}
          </option>
        ))}
      </Select>
    </Flex>
  );
};
