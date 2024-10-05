interface SearchFilterBarProps {
    searchTerm: string;
    onSearch: (term: string) => void;
  }
  
  const SearchFilterBar: React.FC<SearchFilterBarProps> = ({ searchTerm, onSearch }) => {
    return (
      <div className="mb-4 flex items-center space-x-4">
        <input
          type="text"
          placeholder="Search repositories..."
          value={searchTerm}
          onChange={(e) => onSearch(e.target.value)}
          className="border border-gray-300 rounded-md p-2 w-full"
        />
        {/* You can add filter options here, such as dropdowns or checkboxes */}
      </div>
    );
  };
  
  export default SearchFilterBar;