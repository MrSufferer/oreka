import React, { useState, useEffect } from 'react';
import {
  Box,
  Flex,
  Text,
  HStack,
  useColorModeValue,
  Container,
  useDisclosure,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  IconButton,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerCloseButton,
  DrawerHeader,
  DrawerBody,
  VStack,
  Button,
  useBreakpointValue,
  Link as ChakraLink,
} from '@chakra-ui/react';
import { HamburgerIcon, ChevronDownIcon } from '@chakra-ui/icons';
import { useRouter } from 'next/router';
import { AuthClient } from '@dfinity/auth-client';

export default function Header() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userPrincipal, setUserPrincipal] = useState<string | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const isMobile = useBreakpointValue({ base: true, md: false });

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authClient = await AuthClient.create();
        const authenticated = await authClient.isAuthenticated();
        setIsAuthenticated(authenticated);

        if (authenticated) {
          const identity = authClient.getIdentity();
          const principal = identity.getPrincipal().toString();
          setUserPrincipal(principal);
        }
      } catch (error) {
        console.error('Error checking authentication status:', error);
      }
    };

    checkAuth();
  }, []);

  const handleLogin = async () => {
    try {
      const authClient = await AuthClient.create();

      authClient.login({
        identityProvider: process.env.NEXT_PUBLIC_II_URL ||
          (process.env.NODE_ENV !== "production"
            ? "http://localhost:4943?canisterId=rdmx6-jaaaa-aaaaa-aaadq-cai"
            : "https://identity.ic0.app"),
        onSuccess: () => {
          setIsAuthenticated(true);
          const identity = authClient.getIdentity();
          const principal = identity.getPrincipal().toString();
          setUserPrincipal(principal);
        },
      });
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const handleLogout = async () => {
    try {
      const authClient = await AuthClient.create();
      await authClient.logout();
      setIsAuthenticated(false);
      setUserPrincipal(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const navigateTo = (path: string) => {
    router.push(path);
  };

  const isActive = (path: string) => {
    // For the markets page, we need to check if we're on the home page with a marketId query parameter
    if (path === '/markets' && router.pathname === '/' && router.query.marketId) {
      return true;
    }
    return router.pathname === path;
  };

  // Navigation items
  const navItems = [
    { name: 'Home', path: '/' },
    { name: 'Factory', path: '/factory' },
    {
      name: router.pathname === '/' && router.query.marketId
        ? 'Market Details'
        : 'Markets',
      path: '/markets'
    },
  ];

  // Mobile drawer navigation
  const MobileNav = () => (
    <>
      <IconButton
        aria-label="Open menu"
        icon={<HamburgerIcon />}
        variant="ghost"
        color="white"
        onClick={onOpen}
        display={{ base: 'flex', md: 'none' }}
      />
      <Drawer isOpen={isOpen} placement="right" onClose={onClose} size="xs">
        <DrawerOverlay backdropFilter="blur(10px)" bg="rgba(0, 0, 0, 0.3)" />
        <DrawerContent bg="#0a1647">
          <DrawerCloseButton color="white" />
          <DrawerHeader borderBottomWidth="1px" borderColor="rgba(255, 255, 255, 0.1)">
            <Text
              fontSize="xl"
              color="white"
              fontWeight="bold"
              bgGradient="linear(to-r, #4a63c8, #5a73d8, #6a83e8)"
              bgClip="text"
            >
              OREKA
            </Text>
          </DrawerHeader>
          <DrawerBody py={6}>
            <VStack spacing={4} align="stretch">
              {navItems.map((item) => (
                <Button
                  key={item.name}
                  variant="ghost"
                  justifyContent="flex-start"
                  h="48px"
                  color={isActive(item.path) ? "white" : "whiteAlpha.700"}
                  bgColor={isActive(item.path) ? "rgba(74, 99, 200, 0.2)" : "transparent"}
                  borderRadius="md"
                  px={4}
                  fontSize="md"
                  _hover={{ bgColor: "rgba(255, 255, 255, 0.05)", color: "white" }}
                  onClick={() => {
                    navigateTo(item.path);
                    onClose();
                  }}
                  leftIcon={
                    isActive(item.path) ? (
                      <Box w="3px" h="20px" bg="#4a63c8" borderRadius="full" position="absolute" left={0} />
                    ) : undefined
                  }
                >
                  {item.name}
                </Button>
              ))}

              <Box pt={4} mt={4} borderTopWidth="1px" borderColor="rgba(255, 255, 255, 0.1)">
                {isAuthenticated ? (
                  <VStack spacing={3} align="stretch">
                    <Text color="whiteAlpha.700" fontSize="sm" mb={1}>
                      Logged in as:
                    </Text>
                    <Text color="white" fontSize="sm" fontFamily="monospace" isTruncated>
                      {userPrincipal
                        ? `${userPrincipal.substring(0, 8)}...${userPrincipal.substring(userPrincipal.length - 8)}`
                        : "Not signed in"}
                    </Text>
                    <Button
                      colorScheme="blue"
                      variant="outline"
                      size="sm"
                      onClick={handleLogout}
                      mt={2}
                    >
                      Log Out
                    </Button>
                  </VStack>
                ) : (
                  <Button
                    bg="#4a63c8"
                    color="white"
                    size="md"
                    w="full"
                    onClick={handleLogin}
                    _hover={{ bg: "#5a73d8" }}
                  >
                    Log In with Internet Identity
                  </Button>
                )}
              </Box>
            </VStack>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );

  return (
    <Box
      bg="#0a1647"
      boxShadow="0 4px 20px rgba(0, 0, 0, 0.3)"
      zIndex={10}
      position="sticky"
      top={0}
      borderBottom="1px solid rgba(255, 255, 255, 0.05)"
      width="100%"
    >
      <Container maxW="container.lg" py={4} mx="auto">
        <Flex h={16} alignItems="center" justifyContent="space-between" width="100%">
          {/* Logo */}
          <Box cursor="pointer" onClick={() => navigateTo('/')} width="180px">
            <Text
              fontSize="2xl"
              fontWeight="bold"
              color="white"
              bgGradient="linear(to-r, #4a63c8, #5a73d8, #6a83e8)"
              bgClip="text"
              letterSpacing="wider"
              textAlign="center"
            >
              OREKA
            </Text>
          </Box>

          {/* Desktop Navigation */}
          <HStack spacing={8} display={{ base: 'none', md: 'flex' }} justifyContent="center" flex="1">
            {navItems.map((item) => (
              <Box
                key={item.name}
                position="relative"
                cursor="pointer"
                color={isActive(item.path) ? "white" : "whiteAlpha.700"}
                fontWeight={isActive(item.path) ? "semibold" : "normal"}
                _hover={{ color: "white" }}
                onClick={() => navigateTo(item.path)}
                transition="all 0.2s"
              >
                <Text fontSize="md">{item.name}</Text>
                {isActive(item.path) && (
                  <Box
                    position="absolute"
                    bottom="-2px"
                    left="0"
                    width="100%"
                    height="2px"
                    bgGradient="linear(to-r, #4a63c8, #5a73d8, #6a83e8)"
                    borderRadius="full"
                  />
                )}
              </Box>
            ))}
          </HStack>

          {/* Authentication */}
          <HStack spacing={4} justify="flex-end" minW="200px">
            {isAuthenticated ? (
              <Menu>
                <MenuButton
                  as={Button}
                  variant="outline"
                  size="sm"
                  borderColor="rgba(255, 255, 255, 0.2)"
                  color="white"
                  _hover={{ bg: "rgba(255, 255, 255, 0.1)" }}
                  rightIcon={<ChevronDownIcon />}
                  bg="rgba(0, 0, 0, 0.2)"
                >
                  <Text fontSize="sm" isTruncated maxWidth="140px">
                    {userPrincipal
                      ? `${userPrincipal.substring(0, 6)}...${userPrincipal.substring(userPrincipal.length - 4)}`
                      : "Account"}
                  </Text>
                </MenuButton>
                <MenuList bg="#0a1647" borderColor="rgba(255, 255, 255, 0.1)">
                  <MenuItem
                    bg="#0a1647"
                    color="white"
                    _hover={{ bg: "rgba(255, 255, 255, 0.1)" }}
                    onClick={handleLogout}
                    fontSize="sm"
                  >
                    Log Out
                  </MenuItem>
                </MenuList>
              </Menu>
            ) : (
              <Button
                onClick={handleLogin}
                bg="#4a63c8"
                color="white"
                size="sm"
                _hover={{ bg: "#5a73d8" }}
                borderRadius="md"
                fontSize="sm"
                fontWeight="medium"
              >
                Log In
              </Button>
            )}
          </HStack>

          {/* Mobile menu button */}
          <MobileNav />
        </Flex>
      </Container>
    </Box>
  );
}
