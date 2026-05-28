//this is the most beautiful file of them all, the central file to all of the frontend application, the centre of the 2nd system, 1st being the backend, the realisation which struck me was that the organisation of frontend and the backend was not the same thing just at different depths but rather two independent systems working parallely.

import { useNavigate, useLocation } from "react-router-dom";
import { createContext, useContext, useEffect, useState } from "react";
import type { IContextType, IUser } from "../typesOG/note.types";
import { getCurrentUser } from "../api/notesAPIAxios";
import { INITIAL_USER } from "../typesOG/note.types";
import { INITIAL_STATE } from "../typesOG/note.types";
import axios from "axios";




const AuthContext = createContext<IContextType>(INITIAL_STATE);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<IUser>(INITIAL_USER);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Set up axios interceptor for global 401/403 handling
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && (error.response.status === 401 || error.response.status === 403)) {
          console.warn("Session expired or unauthorized, redirecting to sign-in...");
          setIsAuthenticated(false);
          setUser(INITIAL_USER);
          
          const publicPaths = ["/sign-in", "/sign-up", "/"];
          if (!publicPaths.includes(window.location.pathname)) {
            navigate("/sign-in");
          }
        }
        return Promise.reject(error);
      }
    );

    return () => axios.interceptors.response.eject(interceptor);
  }, [navigate]);

  const checkAuthUser = async () => {
  setIsLoading(true);
  try {
    console.log("Calling getCurrentUser..."); // Debug
    const currentAccount = await getCurrentUser();
    console.log("getCurrentUser response:", currentAccount); // Debug
    
    if (currentAccount && !currentAccount.message) {
      setUser({
        id: currentAccount.id,
        username: currentAccount.username,
        email: currentAccount.email,
        first_name: currentAccount.first_name,
        last_name: currentAccount.last_name,
        is_verified: currentAccount.is_verified,
      });
      setIsAuthenticated(true);
      return true;
    }

    console.log("getCurrentUser failed or returned error"); // Debug
    setIsAuthenticated(false);
    setUser(INITIAL_USER);
    
    // Redirect if on protected page
    const publicPaths = ["/sign-in", "/sign-up", "/"];
    if (!publicPaths.includes(location.pathname)) {
      navigate("/sign-in");
    }
    
    return false;
    
  } catch (error) {
    console.error("Auth check failed:", error);
    setIsAuthenticated(false);
    setUser(INITIAL_USER);
    
    const publicPaths = ["/sign-in", "/sign-up", "/"];
    if (!publicPaths.includes(location.pathname)) {
      navigate("/sign-in");
    }
    
    return false;
  } finally {
    setIsLoading(false);
  }
};

  const logout = async () => {
    console.log("Logout initiated...");
    try {
      // Call your logout endpoint to clear HttpOnly cookies
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/v1/auth/logout`, {
        method: "POST",
        credentials: "include", // Important: includes HttpOnly cookies
      });
      console.log("Logout API response status:", response.status);
      
      // Clear local state
      setUser(INITIAL_USER);
      setIsAuthenticated(false);
      
      // Redirect to login
      navigate("/sign-in");
    } catch (error) {
      console.error("Logout failed:", error);
      // Still clear local state even if API call fails
      setUser(INITIAL_USER);
      setIsAuthenticated(false);
      navigate("/sign-in");
    }
  };

  useEffect(() => {
    // With HttpOnly cookies, we can't check localStorage for auth status
    // Instead, we always try to check with the server on mount
    checkAuthUser();
  }, []);

  // Optional: Set up an interval to periodically check auth status
  // This helps handle cases where cookies expire
  useEffect(() => {
    if (isAuthenticated) {
      const authCheckInterval = setInterval(() => {
        checkAuthUser();
      }, 5 * 60 * 1000); // Check every 5 minutes

      return () => clearInterval(authCheckInterval);
    }
  }, [isAuthenticated]);

  const value = {
    user,
    setUser,
    isLoading,
    isAuthenticated,
    setIsAuthenticated,
    checkAuthUser,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useUserContext = () => useContext(AuthContext);