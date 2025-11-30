import { Link } from "react-router";

import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
} from "~/components/ui/navigation-menu"

export const Header = () => {
  return (
    <div className="fixed flex px-6 w-screen h-14 items-center drop-shadow-2xl border-b bg-white border-gray-300 shadow-xs">
      <h1 className="font-bold text-lg pr-4">Convert!</h1>
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <Link to="/video">
              <NavigationMenuLink>
                video size
              </NavigationMenuLink>
            </Link>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <Link to="/image">
              <NavigationMenuLink>
                image size
              </NavigationMenuLink>
            </Link>
          </NavigationMenuItem>
           <NavigationMenuItem>
            <Link to="/imageconvert">
              <NavigationMenuLink>
                image format
              </NavigationMenuLink>
            </Link>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <Link to="/base64image">
              <NavigationMenuLink>
                base64 to image
              </NavigationMenuLink>
            </Link>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  );
};