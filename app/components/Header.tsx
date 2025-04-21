import { Link } from "react-router";

import { Button } from "~/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
} from "~/components/ui/navigation-menu"

export const Header = () => {
  return (
    <div className="fixed flex px-6 w-screen h-14 items-center drop-shadow-2xl border-b bg-white border-gray-300 shadow-xs">
      <h1 className="font-bold text-lg pr-4">Resize Tool</h1>
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <Link to="/video">
              <NavigationMenuLink>
                Video
              </NavigationMenuLink>
            </Link>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <Link to="/image">
              <NavigationMenuLink>
                Image
              </NavigationMenuLink>
            </Link>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  );
};